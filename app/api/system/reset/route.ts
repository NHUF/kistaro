import { NextResponse } from "next/server";
import { resetInventorySystem } from "@/lib/system-reset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as {
      confirm?: string;
      deleteTemplates?: boolean;
    };

    if (payload.confirm !== "RESET") {
      return NextResponse.json(
        { error: "Zurücksetzen wurde nicht bestätigt." },
        { status: 400 },
      );
    }

    const result = await resetInventorySystem({
      deleteTemplates: payload.deleteTemplates === true,
    });

    return NextResponse.json({
      success: true,
      message: result.deleteTemplates
        ? "System wurde zurückgesetzt. Inventar und Vorlagen wurden geleert."
        : "System wurde zurückgesetzt. Inventar wurde geleert, Vorlagen wurden behalten.",
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "System konnte nicht zurückgesetzt werden.",
      },
      { status: 500 },
    );
  }
}
