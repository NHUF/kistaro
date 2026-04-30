import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { logSystemActivity } from "@/lib/system-activity";

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

function createSingleFileZip(fileName: string, fileContent: Buffer) {
  const fileNameBuffer = Buffer.from(fileName, "utf8");
  const localHeader = Buffer.alloc(30);
  const centralHeader = Buffer.alloc(46);
  const endOfCentralDirectory = Buffer.alloc(22);
  const checksum = crc32(fileContent);

  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(0, 8);
  localHeader.writeUInt16LE(0, 10);
  localHeader.writeUInt16LE(0, 12);
  localHeader.writeUInt32LE(checksum, 14);
  localHeader.writeUInt32LE(fileContent.length, 18);
  localHeader.writeUInt32LE(fileContent.length, 22);
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
  centralHeader.writeUInt32LE(fileContent.length, 20);
  centralHeader.writeUInt32LE(fileContent.length, 24);
  centralHeader.writeUInt16LE(fileNameBuffer.length, 28);
  centralHeader.writeUInt16LE(0, 30);
  centralHeader.writeUInt16LE(0, 32);
  centralHeader.writeUInt16LE(0, 34);
  centralHeader.writeUInt16LE(0, 36);
  centralHeader.writeUInt32LE(0, 38);
  centralHeader.writeUInt32LE(0, 42);

  const centralDirectoryOffset = localHeader.length + fileNameBuffer.length + fileContent.length;
  const centralDirectorySize = centralHeader.length + fileNameBuffer.length;

  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(1, 8);
  endOfCentralDirectory.writeUInt16LE(1, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectorySize, 12);
  endOfCentralDirectory.writeUInt32LE(centralDirectoryOffset, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  return Buffer.concat([
    localHeader,
    fileNameBuffer,
    fileContent,
    centralHeader,
    fileNameBuffer,
    endOfCentralDirectory,
  ]);
}

function extractSingleFileZip(zipBuffer: Buffer) {
  if (zipBuffer.readUInt32LE(0) !== 0x04034b50) {
    throw new Error("Ungültiges ZIP-Format.");
  }

  const compressionMethod = zipBuffer.readUInt16LE(8);

  if (compressionMethod !== 0) {
    throw new Error("Dieses ZIP-Format wird nicht unterstützt.");
  }

  const fileNameLength = zipBuffer.readUInt16LE(26);
  const extraLength = zipBuffer.readUInt16LE(28);
  const compressedSize = zipBuffer.readUInt32LE(18);
  const contentStart = 30 + fileNameLength + extraLength;
  const contentEnd = contentStart + compressedSize;

  return zipBuffer.subarray(contentStart, contentEnd);
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

  await logSystemActivity({
    title: "Datenbank-Backup erstellt",
    description: "Ein lokales PostgreSQL-Backup wurde über die Systemseite erzeugt.",
    metadata: { created_at: new Date().toISOString() },
  });

  return {
    fileName: `kistaro-backup-${makeTimestamp()}.zip`,
    buffer: createSingleFileZip("database.sql", Buffer.from(databaseSql, "utf8")),
  };
}

export function parseDatabaseBackupZip(zipBuffer: Buffer) {
  return extractSingleFileZip(zipBuffer).toString("utf8");
}

export async function restoreDatabaseBackupReplace(databaseSql: string) {
  const tempDirectory = mkdtempSync(join(tmpdir(), "kistaro-restore-"));
  const sqlPath = join(tempDirectory, "database.sql");

  try {
    writeFileSync(sqlPath, databaseSql, "utf8");
    preCleanDatabaseForRestore();

    runPostgresCommand("psql", [
      "--dbname",
      getDatabaseUrl(),
      "--set",
      "ON_ERROR_STOP=1",
      "--file",
      sqlPath,
    ]);

    await logSystemActivity({
      title: "Datenbank aus Backup wiederhergestellt",
      description: "Die lokale PostgreSQL-Datenbank wurde per Systemseite vollständig ersetzt.",
      metadata: { restored_at: new Date().toISOString() },
    });
  } finally {
    rmSync(tempDirectory, { recursive: true, force: true });
  }
}
