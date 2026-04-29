import { NextResponse } from "next/server";
import { writeStorageFile } from "@/lib/local-file-storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const bucket = String(formData.get("bucket") ?? "");
    const path = String(formData.get("path") ?? "");
    const file = formData.get("file");

    if (!(file instanceof File) || !bucket || !path) {
      return NextResponse.json(
        { error: { message: "Upload-Daten sind unvollständig." } },
        { status: 400 },
      );
    }

    writeStorageFile(bucket, path, Buffer.from(await file.arrayBuffer()));

    return NextResponse.json({ data: { path }, error: null });
  } catch (error) {
    return NextResponse.json(
      {
        data: null,
        error: {
          message: error instanceof Error ? error.message : "Datei konnte nicht gespeichert werden.",
        },
      },
      { status: 500 },
    );
  }
}
