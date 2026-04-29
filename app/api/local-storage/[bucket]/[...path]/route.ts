import { NextResponse } from "next/server";
import { getContentType, readStorageFile } from "@/lib/local-file-storage";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ bucket: string; path: string[] }> },
) {
  const { bucket, path } = await params;
  const relativePath = path.join("/");
  const file = readStorageFile(bucket, relativePath);

  if (!file) {
    return new NextResponse("Nicht gefunden", { status: 404 });
  }

  return new NextResponse(file, {
    headers: {
      "Content-Type": getContentType(relativePath),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
