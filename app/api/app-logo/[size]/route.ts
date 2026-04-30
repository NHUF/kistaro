import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const LOGO_FILES: Record<string, string> = {
  "16": "kistaro-logo-16.png",
  "32": "kistaro-logo-32.png",
  "48": "kistaro-logo-48.png",
  "512": "kistaro-logo.png",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  const { size } = await params;
  const fileName = LOGO_FILES[size] ?? LOGO_FILES["512"];
  const filePath = resolve(/*turbopackIgnore: true*/ process.cwd(), "public", fileName);
  const image = await readFile(filePath);

  return new NextResponse(image, {
    headers: {
      "Cache-Control": "public, max-age=86400",
      "Content-Type": "image/png",
    },
  });
}
