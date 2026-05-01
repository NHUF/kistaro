import { spawn } from "node:child_process";
import { NextResponse } from "next/server";
import { logSystemActivity } from "@/lib/system-activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function triggerReboot() {
  if (process.platform === "win32") {
    const child = spawn("cmd.exe", ["/c", "shutdown /r /t 3"], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    return;
  }

  const child = spawn("bash", ["-lc", "sleep 2 && systemctl reboot"], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

export async function POST() {
  try {
    await logSystemActivity({
      title: "System-Neustart angefordert",
      description: "Der Neustart wurde über die Systemseite ausgelöst.",
      metadata: {
        requested_at: new Date().toISOString(),
      },
    });

    triggerReboot();

    return NextResponse.json({
      success: true,
      message: "Neustart wird ausgelöst. Die Verbindung kann gleich kurz unterbrochen werden.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Neustart konnte nicht ausgelöst werden.",
      },
      { status: 500 },
    );
  }
}
