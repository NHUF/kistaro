import { NextResponse } from "next/server";
import { executeLocalDataRequest } from "@/lib/local-data-server";
import type { LocalQueryRequest } from "@/lib/local-data-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = (await request.json()) as LocalQueryRequest;
  const result = await executeLocalDataRequest(payload);

  return NextResponse.json(result, {
    status: result.error ? 400 : 200,
  });
}
