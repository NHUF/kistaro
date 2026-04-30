import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import { NextResponse } from "next/server";
import { createDatabaseBackupZip } from "@/lib/system-backup";
import {
  checkForInventoryUpdate,
  getUpdateStatusPath,
  readUpdateStatus,
  writeUpdateStatus,
} from "@/lib/system-updates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getUpdateScriptPath() {
  return resolve(
    /*turbopackIgnore: true*/ process.cwd(),
    "deploy/proxmox/update-instance.sh",
  );
}

function getBackupDirectory() {
  return resolve(
    /*turbopackIgnore: true*/ process.cwd(),
    process.env.INVENTORY_BACKUP_DIR || "storage/backups",
  );
}

export async function GET() {
  const update = await checkForInventoryUpdate();

  return NextResponse.json(update, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as { force?: boolean };
  const force = payload.force === true;
  const update = await checkForInventoryUpdate();

  if (!update.configured) {
    return NextResponse.json(
      { error: update.error ?? "Updates sind nicht konfiguriert." },
      { status: 400 },
    );
  }

  if (update.error) {
    return NextResponse.json({ error: update.error }, { status: 502 });
  }

  if ((!update.updateAvailable && !force) || !update.latestTag || !update.tarballUrl) {
    return NextResponse.json(
      { error: "Es ist kein neueres Release verfügbar." },
      { status: 409 },
    );
  }

  try {
    const backup = await createDatabaseBackupZip();
    const backupPath = resolve(getBackupDirectory(), `pre-update-${backup.fileName}`);

    mkdirSync(dirname(backupPath), { recursive: true });
    writeFileSync(backupPath, backup.buffer);
    writeUpdateStatus({
      state: "running",
      targetTag: update.latestTag,
      message: "Update wurde vorbereitet und startet.",
      progress: 5,
      startedAt: new Date().toISOString(),
      finishedAt: null,
    });

    const child = spawn("bash", [getUpdateScriptPath()], {
      cwd: process.cwd(),
      detached: true,
      stdio: "ignore",
      env: {
        ...process.env,
        INVENTORY_UPDATE_TARGET_TAG: update.latestTag,
        INVENTORY_UPDATE_TARBALL_URL: update.tarballUrl,
        INVENTORY_PRE_UPDATE_BACKUP: backupPath,
        INVENTORY_UPDATE_STATUS_FILE: getUpdateStatusPath(),
      },
    });

    child.unref();

    return NextResponse.json({
      success: true,
      message:
        "Update wurde gestartet. Die App erstellt ein Backup, lädt die neue Version und startet den Dienst neu.",
      targetVersion: update.latestVersion,
      targetTag: update.latestTag,
      backupPath,
      updateStatus: readUpdateStatus(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Update konnte nicht gestartet werden.",
      },
      { status: 500 },
    );
  }
}
