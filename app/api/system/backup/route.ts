import { NextResponse } from "next/server";
import { createDatabaseBackupZip, parseDatabaseBackupZip, restoreDatabaseBackupReplace } from "@/lib/system-backup";

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
    const formData = await request.formData();
    const mode = String(formData.get("mode") ?? "replace");
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Bitte eine Backup-Datei auswählen." }, { status: 400 });
    }

    if (mode !== "replace") {
      return NextResponse.json(
        { error: "Aktuell wird nur Wiederherstellen mit Ersetzen unterstützt." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
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
