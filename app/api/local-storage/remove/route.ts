import { NextResponse } from "next/server";
import { removeStorageFile } from "@/lib/local-file-storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { bucket?: string; paths?: string[] };
    const bucket = body.bucket ?? "";
    const paths = body.paths ?? [];
    const removed = paths.filter((path) => removeStorageFile(bucket, path)).length;

    return NextResponse.json({ data: { removed }, error: null });
  } catch (error) {
    return NextResponse.json(
      {
        data: null,
        error: {
          message: error instanceof Error ? error.message : "Datei konnte nicht entfernt werden.",
        },
      },
      { status: 500 },
    );
  }
}
