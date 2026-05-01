import { NextResponse } from "next/server";
import {
  createDatabaseBackupZip,
  parseDatabaseBackupZip,
  restoreDatabaseBackupReplace,
} from "@/lib/system-backup";

export const runtime = "nodejs";

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
    const contentType = request.headers.get("content-type") ?? "";
    const modeHeader = request.headers.get("x-kistaro-restore-mode");
    let mode = "replace";
    let fileName = "backup.zip";
    let buffer: Buffer;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      mode = String(formData.get("mode") ?? "replace");
      const file = formData.get("file");

      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Bitte eine Backup-Datei auswählen." }, { status: 400 });
      }

      fileName = file.name || fileName;
      buffer = Buffer.from(await file.arrayBuffer());
    } else {
      mode = String(modeHeader ?? "replace");
      fileName = request.headers.get("x-kistaro-backup-name") ?? fileName;

      const rawBody = await request.arrayBuffer();

      if (rawBody.byteLength === 0) {
        return NextResponse.json({ error: "Bitte eine Backup-Datei auswählen." }, { status: 400 });
      }

      buffer = Buffer.from(rawBody);
    }

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

    await restoreDatabaseBackupReplace(parsedBackup);

    return NextResponse.json({
      success: true,
      message: "Backup erfolgreich eingespielt. Die aktuelle Datenbank wurde ersetzt.",
    });
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
