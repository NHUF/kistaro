import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { NextResponse } from "next/server";
import {
  createDatabaseBackupZip,
  parseDatabaseBackupZip,
  restoreDatabaseBackupReplace,
} from "@/lib/system-backup";

export const runtime = "nodejs";

const RESTORE_UPLOAD_ROOT = resolve(
  /*turbopackIgnore: true*/ process.cwd(),
  "storage",
  "restore-uploads",
);

type RestoreUpload = {
  buffer: Buffer;
  fileName: string;
  mode: string;
};

function decodeHeaderFileName(value: string | null) {
  if (!value) {
    return "backup.zip";
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getHeaderInteger(request: Request, name: string) {
  const value = request.headers.get(name);

  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function getSafeUploadId(value: string | null) {
  if (!value || !/^[a-zA-Z0-9_-]{8,120}$/.test(value)) {
    throw new Error("Backup-Upload konnte nicht eindeutig zugeordnet werden.");
  }

  return value;
}

async function readRawBody(request: Request) {
  const buffer = Buffer.from(await request.arrayBuffer());
  const declaredLength = getHeaderInteger(request, "content-length");

  if (declaredLength !== null && declaredLength !== buffer.length) {
    throw new Error(
      `Backup-Upload wurde unvollständig empfangen: erwartet ${declaredLength} Bytes, erhalten ${buffer.length} Bytes.`,
    );
  }

  return buffer;
}

function getMultipartBoundary(contentType: string) {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  return match?.[1] ?? match?.[2] ?? null;
}

function parseContentDispositionValue(header: string, key: "name" | "filename") {
  const match = header.match(new RegExp(`${key}="([^"]*)"`));
  return match?.[1] ?? null;
}

function parseMultipartRestoreUpload(contentType: string, body: Buffer): RestoreUpload {
  const boundaryValue = getMultipartBoundary(contentType);

  if (!boundaryValue) {
    throw new Error("Backup-Upload konnte nicht gelesen werden.");
  }

  const boundary = Buffer.from(`--${boundaryValue}`);
  const headerSeparator = Buffer.from("\r\n\r\n");
  const nextBoundaryPrefix = Buffer.from(`\r\n--${boundaryValue}`);
  let offset = 0;
  let mode = "replace";
  let fileName = "backup.zip";
  let buffer: Buffer | null = null;

  while (offset < body.length) {
    const boundaryStart = body.indexOf(boundary, offset);

    if (boundaryStart < 0) {
      break;
    }

    const partStart = boundaryStart + boundary.length;

    if (body.subarray(partStart, partStart + 2).toString("utf8") === "--") {
      break;
    }

    const headerStart = body.subarray(partStart, partStart + 2).toString("utf8") === "\r\n"
      ? partStart + 2
      : partStart;
    const headerEnd = body.indexOf(headerSeparator, headerStart);

    if (headerEnd < 0) {
      break;
    }

    const contentStart = headerEnd + headerSeparator.length;
    const contentEnd = body.indexOf(nextBoundaryPrefix, contentStart);

    if (contentEnd < 0) {
      break;
    }

    const headers = body.subarray(headerStart, headerEnd).toString("utf8");
    const disposition = headers
      .split(/\r?\n/)
      .find((line) => line.toLowerCase().startsWith("content-disposition:"));
    const fieldName = parseContentDispositionValue(disposition ?? "", "name");
    const uploadedFileName = parseContentDispositionValue(disposition ?? "", "filename");
    const content = body.subarray(contentStart, contentEnd);

    if (fieldName === "mode") {
      mode = content.toString("utf8").trim() || "replace";
    }

    if (fieldName === "file") {
      fileName = uploadedFileName || fileName;
      buffer = Buffer.from(content);
    }

    offset = contentEnd + nextBoundaryPrefix.length;
  }

  if (!buffer) {
    throw new Error("Bitte eine Backup-Datei auswählen.");
  }

  return {
    buffer,
    fileName,
    mode,
  };
}

async function readRestoreUpload(request: Request): Promise<RestoreUpload> {
  const contentType = request.headers.get("content-type") ?? "";
  const modeHeader = request.headers.get("x-kistaro-restore-mode");

  if (contentType.includes("multipart/form-data")) {
    const fallbackRequest = request.clone();

    try {
      const formData = await request.formData();
      const mode = String(formData.get("mode") ?? "replace");
      const file = formData.get("file");

      if (!(file instanceof File)) {
        throw new Error("Bitte eine Backup-Datei auswählen.");
      }

      return {
        mode,
        fileName: file.name || "backup.zip",
        buffer: Buffer.from(await file.arrayBuffer()),
      };
    } catch (error) {
      if (error instanceof Error && !error.message.includes("FormData")) {
        throw error;
      }

      // Some proxies/deployments produce multipart bodies that Next cannot
      // parse reliably. The manual fallback keeps restore usable for older
      // clients instead of surfacing a framework parser error to the user.
      return parseMultipartRestoreUpload(
        contentType,
        Buffer.from(await fallbackRequest.arrayBuffer()),
      );
    }
  }

  const rawBody = await readRawBody(request);

  if (rawBody.length === 0) {
    throw new Error("Bitte eine Backup-Datei auswählen.");
  }

  return {
    mode: String(modeHeader ?? "replace"),
    fileName: decodeHeaderFileName(request.headers.get("x-kistaro-backup-name")),
    buffer: rawBody,
  };
}

async function restoreBackup(buffer: Buffer, fileName: string, mode: string) {
  if (mode !== "replace") {
    return NextResponse.json(
      { error: "Aktuell wird nur Wiederherstellen mit Ersetzen unterstützt." },
      { status: 400 },
    );
  }

  if (!fileName.toLowerCase().endsWith(".zip")) {
    return NextResponse.json(
      { error: "Bitte ein Kistaro-Backup als ZIP-Datei hochladen." },
      { status: 400 },
    );
  }

  const parsedBackup = parseDatabaseBackupZip(buffer);
  const restoredBackup = await restoreDatabaseBackupReplace(parsedBackup);

  return NextResponse.json({
    success: true,
    message: restoredBackup.storageRestored
      ? `Backup erfolgreich eingespielt. Datenbank und ${restoredBackup.storageFileCount} Storage-Dateien wurden ersetzt.`
      : "Backup erfolgreich eingespielt. Die aktuelle Datenbank wurde ersetzt.",
  });
}

async function handleChunkedRestoreUpload(request: Request) {
  const uploadId = getSafeUploadId(request.headers.get("x-kistaro-upload-id"));
  const chunkIndex = getHeaderInteger(request, "x-kistaro-upload-index");
  const chunkTotal = getHeaderInteger(request, "x-kistaro-upload-total");
  const expectedFileSize = getHeaderInteger(request, "x-kistaro-upload-size");
  const mode = String(request.headers.get("x-kistaro-restore-mode") ?? "replace");
  const fileName = decodeHeaderFileName(request.headers.get("x-kistaro-backup-name"));

  if (
    chunkIndex === null ||
    chunkTotal === null ||
    chunkTotal < 1 ||
    chunkIndex < 0 ||
    chunkIndex >= chunkTotal
  ) {
    throw new Error("Backup-Upload enthält ungültige Block-Informationen.");
  }

  const uploadDirectory = join(RESTORE_UPLOAD_ROOT, uploadId);
  const chunkPath = join(uploadDirectory, `${chunkIndex}.part`);
  const chunk = await readRawBody(request);

  if (chunk.length === 0) {
    throw new Error("Ein Backup-Block wurde leer übertragen.");
  }

  mkdirSync(uploadDirectory, { recursive: true });
  writeFileSync(chunkPath, chunk);

  const receivedChunkCount = readdirSync(uploadDirectory)
    .filter((entry) => entry.endsWith(".part"))
    .length;

  if (receivedChunkCount < chunkTotal) {
    return NextResponse.json({
      success: true,
      partial: true,
      progress: Math.floor((receivedChunkCount / chunkTotal) * 100),
      message: `Backup wird hochgeladen (${receivedChunkCount}/${chunkTotal}).`,
    });
  }

  try {
    const chunks: Buffer[] = [];

    for (let index = 0; index < chunkTotal; index += 1) {
      const currentPath = join(uploadDirectory, `${index}.part`);

      if (!existsSync(currentPath)) {
        throw new Error(`Backup-Upload ist unvollständig: Block ${index + 1} fehlt.`);
      }

      chunks.push(readFileSync(currentPath));
    }

    const backupBuffer = Buffer.concat(chunks);

    if (expectedFileSize !== null && backupBuffer.length !== expectedFileSize) {
      throw new Error(
        `Backup-Upload ist unvollständig: erwartet ${expectedFileSize} Bytes, erhalten ${backupBuffer.length} Bytes.`,
      );
    }

    return await restoreBackup(backupBuffer, fileName, mode);
  } finally {
    rmSync(uploadDirectory, { recursive: true, force: true });
  }
}

export async function GET() {
  try {
    const backup = await createDatabaseBackupZip();

    return new NextResponse(backup.buffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${backup.fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Backup konnte nicht erstellt werden." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    if (request.headers.has("x-kistaro-upload-id")) {
      return await handleChunkedRestoreUpload(request);
    }

    const { buffer, fileName, mode } = await readRestoreUpload(request);
    return await restoreBackup(buffer, fileName, mode);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Backup konnte nicht eingespielt werden.",
      },
      { status: 500 },
    );
  }
}
