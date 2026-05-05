import { runGhlBatch } from "@/lib/cronGhl";
import { verifyCronSecret } from "@/lib/runtime";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

async function handle(request: Request) {
  const unauthorized = verifyCronSecret(request);
  if (unauthorized) return unauthorized;

  const outcome = await runGhlBatch();
  if (!outcome.ok) {
    return NextResponse.json(outcome, { status: 500 });
  }
  return NextResponse.json(outcome);
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
