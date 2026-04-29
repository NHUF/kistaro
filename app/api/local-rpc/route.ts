import { NextResponse } from "next/server";
import { executeLocalRpc } from "@/lib/local-rpc-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    name?: string;
    params?: Record<string, unknown>;
  };

  const result = await executeLocalRpc(payload.name ?? "", payload.params ?? {});

  return NextResponse.json(result, {
    status: result.error ? 400 : 200,
  });
}
