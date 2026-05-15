import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { getStorageRoot } from "@/lib/local-file-storage";
import { logSystemActivity } from "@/lib/system-activity";

type ZipEntry = {
  name: string;
  content: Buffer;
};

type ParsedBackup = {
  databaseSql: string;
  replaceStorage: boolean;
  storageEntries: ZipEntry[];
  storageManifest: StorageManifest | null;
};

type StorageManifest = {
  version: number;
  file_count: number;
  total_bytes?: number;
  files?: Array<{
    crc32: string;
    path: string;
    size: number;
  }>;
};

function getDatabaseUrl() {
  const user = encodeURIComponent(process.env.POSTGRES_USER || "kistaro");
  const password = encodeURIComponent(process.env.POSTGRES_PASSWORD || "kistaro");
  const database = encodeURIComponent(process.env.POSTGRES_DB || "kistaro");

  return (
    process.env.DATABASE_URL ||
    `postgres://${user}:${password}@${process.env.POSTGRES_HOST || "127.0.0.1"}:${process.env.POSTGRES_PORT || "5432"}/${database}`
  );
}

function makeTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function createCrc32Table() {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }

    table[index] = value >>> 0;
  }

  return table;
}

const CRC32_TABLE = createCrc32Table();

function crc32(buffer: Buffer) {
  let value = 0xffffffff;

  for (const byte of buffer) {
    value = CRC32_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  }

  return (value ^ 0xffffffff) >>> 0;
}

function createZip(entries: ZipEntry[]) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const fileNameBuffer = Buffer.from(entry.name, "utf8");
    const localHeader = Buffer.alloc(30);
    const centralHeader = Buffer.alloc(46);
    const checksum = crc32(entry.content);

    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(entry.content.length, 18);
    localHeader.writeUInt32LE(entry.content.length, 22);
    localHeader.writeUInt16LE(fileNameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(entry.content.length, 20);
    centralHeader.writeUInt32LE(entry.content.length, 24);
    centralHeader.writeUInt16LE(fileNameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    localParts.push(localHeader, fileNameBuffer, entry.content);
    centralParts.push(centralHeader, fileNameBuffer);
    offset += localHeader.length + fileNameBuffer.length + entry.content.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endOfCentralDirectory = Buffer.alloc(22);

  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(entries.length, 8);
  endOfCentralDirectory.writeUInt16LE(entries.length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(offset, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, endOfCentralDirectory]);
}

function extractZipEntries(zipBuffer: Buffer) {
  const entries = new Map<string, Buffer>();
  let offset = 0;

  while (offset + 30 <= zipBuffer.length) {
    const signature = zipBuffer.readUInt32LE(offset);

    if (signature === 0x02014b50 || signature === 0x06054b50) {
      break;
    }

    if (signature !== 0x04034b50) {
      throw new Error("Ungültiges ZIP-Format.");
    }

    const compressionMethod = zipBuffer.readUInt16LE(offset + 8);

    if (compressionMethod !== 0) {
      throw new Error("Dieses ZIP-Format wird nicht unterstützt.");
    }

    const expectedChecksum = zipBuffer.readUInt32LE(offset + 14);
    const compressedSize = zipBuffer.readUInt32LE(offset + 18);
    const fileNameLength = zipBuffer.readUInt16LE(offset + 26);
    const extraLength = zipBuffer.readUInt16LE(offset + 28);
    const fileNameStart = offset + 30;
    const fileNameEnd = fileNameStart + fileNameLength;
    const contentStart = fileNameEnd + extraLength;
    const contentEnd = contentStart + compressedSize;

    if (fileNameEnd > zipBuffer.length || contentEnd > zipBuffer.length) {
      throw new Error("Backup-ZIP ist unvollständig oder beschädigt.");
    }

    const fileName = zipBuffer.subarray(fileNameStart, fileNameEnd).toString("utf8");
    const content = zipBuffer.subarray(contentStart, contentEnd);

    if (crc32(content) !== expectedChecksum) {
      throw new Error(`Backup-Datei ${fileName} ist beschädigt.`);
    }

    entries.set(fileName, content);
    offset = contentEnd;
  }

  return entries;
}

function assertSafeBackupPath(path: string) {
  if (!path || path.includes("..") || path.includes(":") || path.includes("\\") || path.startsWith("/")) {
    throw new Error("Backup enthält einen ungültigen Dateipfad.");
  }
}

function collectStorageEntries() {
  const storageRoot = getStorageRoot();
  const entries: ZipEntry[] = [];

  if (!existsSync(storageRoot)) {
    return entries;
  }

  function walk(directory: string) {
    for (const entryName of readdirSync(directory)) {
      const absolutePath = join(directory, entryName);
      const stats = statSync(absolutePath);

      if (stats.isDirectory()) {
        walk(absolutePath);
        continue;
      }

      if (!stats.isFile()) {
        continue;
      }

      const relativePath = relative(storageRoot, absolutePath).split("\\").join("/");

      entries.push({
        name: `storage/uploads/${relativePath}`,
        content: readFileSync(absolutePath),
      });
    }
  }

  walk(storageRoot);
  return entries;
}

function createStorageManifest(entries: ZipEntry[]): StorageManifest {
  const files = entries
    .filter((entry) => entry.name.startsWith("storage/uploads/"))
    .map((entry) => ({
      path: entry.name.replace(/^storage\/uploads\//, ""),
      size: entry.content.length,
      crc32: crc32(entry.content).toString(16).padStart(8, "0"),
    }))
    .sort((left, right) => left.path.localeCompare(right.path));

  return {
    version: 2,
    file_count: files.length,
    total_bytes: files.reduce((sum, file) => sum + file.size, 0),
    files,
  };
}

function parseStorageManifest(content: Buffer | undefined): StorageManifest | null {
  if (!content) {
    return null;
  }

  try {
    const manifest = JSON.parse(content.toString("utf8")) as StorageManifest;

    if (typeof manifest.file_count !== "number") {
      throw new Error("Storage-Manifest enthält keine gültige Datei-Anzahl.");
    }

    return manifest;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Storage-Manifest konnte nicht gelesen werden.");
  }
}

function validateStorageEntries(entries: ZipEntry[], manifest: StorageManifest | null) {
  if (!manifest) {
    return;
  }

  if (entries.length !== manifest.file_count) {
    throw new Error(
      `Backup-Storage ist unvollständig: erwartet ${manifest.file_count}, gefunden ${entries.length}.`,
    );
  }

  for (const file of manifest.files ?? []) {
    assertSafeBackupPath(file.path);
    const entryName = `storage/uploads/${file.path}`;
    const entry = entries.find((candidate) => candidate.name === entryName);

    if (!entry) {
      throw new Error(`Backup-Storage fehlt Datei: ${file.path}.`);
    }

    if (entry.content.length !== file.size || crc32(entry.content).toString(16).padStart(8, "0") !== file.crc32) {
      throw new Error(`Backup-Storage-Datei ist beschädigt: ${file.path}.`);
    }
  }
}

function verifyRestoredStorageEntries(entries: ZipEntry[]) {
  const storageRoot = getStorageRoot();

  for (const entry of entries) {
    const relativePath = entry.name.replace(/^storage\/uploads\//, "");
    const targetPath = join(storageRoot, relativePath);

    if (!existsSync(targetPath)) {
      throw new Error(`Storage-Datei wurde nicht wiederhergestellt: ${relativePath}.`);
    }

    const restoredContent = readFileSync(targetPath);

    if (restoredContent.length !== entry.content.length || crc32(restoredContent) !== crc32(entry.content)) {
      throw new Error(`Storage-Datei wurde fehlerhaft wiederhergestellt: ${relativePath}.`);
    }
  }
}

function restoreStorageEntries(entries: ZipEntry[]) {
  const storageRoot = getStorageRoot();

  rmSync(storageRoot, { recursive: true, force: true });
  mkdirSync(storageRoot, { recursive: true });

  for (const entry of entries) {
    assertSafeBackupPath(entry.name);

    if (!entry.name.startsWith("storage/uploads/")) {
      continue;
    }

    const relativePath = entry.name.replace(/^storage\/uploads\//, "");
    const targetPath = join(storageRoot, relativePath);

    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, entry.content);
  }

  verifyRestoredStorageEntries(entries);
}

function runPostgresCommand(command: "pg_dump" | "psql", args: string[]) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || `${command} ist fehlgeschlagen.`);
  }

  return result.stdout;
}

function preCleanDatabaseForRestore() {
  // pg_dump --clean can try to drop schema public while local extensions still
  // depend on it. Cleaning those dependencies first keeps restore predictable.
  runPostgresCommand("psql", [
    "--dbname",
    getDatabaseUrl(),
    "--set",
    "ON_ERROR_STOP=1",
    "--command",
    'drop extension if exists pgcrypto cascade; drop extension if exists "uuid-ossp" cascade;',
  ]);
}

export async function createDatabaseBackupZip() {
  const databaseSql = runPostgresCommand("pg_dump", [
    "--dbname",
    getDatabaseUrl(),
    "--schema",
    "public",
    "--clean",
    "--if-exists",
    "--no-owner",
    "--no-privileges",
  ]);
  const storageEntries = collectStorageEntries();
  const storageManifest = createStorageManifest(storageEntries);

  await logSystemActivity({
    title: "Datenbank-Backup erstellt",
    description: "Ein lokales PostgreSQL-Backup inklusive Storage-Dateien wurde über die Systemseite erzeugt.",
    metadata: {
      created_at: new Date().toISOString(),
      storage_file_count: storageManifest.file_count,
      storage_total_bytes: storageManifest.total_bytes ?? 0,
    },
  });

  return {
    fileName: `kistaro-backup-${makeTimestamp()}.zip`,
    buffer: createZip([
      { name: "database.sql", content: Buffer.from(databaseSql, "utf8") },
      {
        name: "storage/manifest.json",
        content: Buffer.from(JSON.stringify(storageManifest, null, 2), "utf8"),
      },
      ...storageEntries,
    ]),
  };
}

export function parseDatabaseBackupZip(zipBuffer: Buffer): ParsedBackup {
  const entries = extractZipEntries(zipBuffer);
  const databaseSql = entries.get("database.sql");
  const storageEntries = Array.from(entries.entries())
    .filter(([name]) => name.startsWith("storage/uploads/"))
    .map(([name, content]) => ({ name, content }));
  const storageManifest = parseStorageManifest(entries.get("storage/manifest.json"));

  if (!databaseSql) {
    throw new Error("Backup enthält keine database.sql.");
  }

  validateStorageEntries(storageEntries, storageManifest);

  return {
    databaseSql: databaseSql.toString("utf8"),
    replaceStorage: Boolean(storageManifest),
    storageEntries,
    storageManifest,
  };
}

export async function restoreDatabaseBackupReplace(parsedBackup: ParsedBackup) {
  const tempDirectory = mkdtempSync(join(tmpdir(), "kistaro-restore-"));
  const sqlPath = join(tempDirectory, "database.sql");

  try {
    writeFileSync(sqlPath, parsedBackup.databaseSql, "utf8");
    preCleanDatabaseForRestore();

    runPostgresCommand("psql", [
      "--dbname",
      getDatabaseUrl(),
      "--set",
      "ON_ERROR_STOP=1",
      "--file",
      sqlPath,
    ]);
    if (parsedBackup.replaceStorage) {
      validateStorageEntries(parsedBackup.storageEntries, parsedBackup.storageManifest);
      restoreStorageEntries(parsedBackup.storageEntries);
    }

    await logSystemActivity({
      title: "Datenbank aus Backup wiederhergestellt",
      description: "Die lokale PostgreSQL-Datenbank und Storage-Dateien wurden per Systemseite vollständig ersetzt.",
      metadata: {
        restored_at: new Date().toISOString(),
        storage_file_count: parsedBackup.storageEntries.length,
        storage_restored: parsedBackup.replaceStorage,
      },
    });

    return {
      storageFileCount: parsedBackup.storageEntries.length,
      storageRestored: parsedBackup.replaceStorage,
    };
  } finally {
    rmSync(tempDirectory, { recursive: true, force: true });
  }
}
