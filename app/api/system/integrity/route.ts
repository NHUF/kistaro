import { NextResponse } from "next/server";
import {
  repairInventoryIntegrity,
  scanInventoryIntegrity,
} from "@/lib/system-integrity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const report = await scanInventoryIntegrity();

    return NextResponse.json(report, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Integritaetspruefung konnte nicht ausgefuehrt werden.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as
      | { action: "repair"; issueId: string; targetLocationId?: string | null }
      | { action: "repair_all_safe" };

    if (!payload?.action) {
      return NextResponse.json({ error: "Aktion fehlt." }, { status: 400 });
    }

    const result = await repairInventoryIntegrity(payload);
    const report = await scanInventoryIntegrity();

    return NextResponse.json({
      ...result,
      report,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Integritaetsreparatur konnte nicht ausgefuehrt werden.",
      },
      { status: 500 },
    );
  }
}
