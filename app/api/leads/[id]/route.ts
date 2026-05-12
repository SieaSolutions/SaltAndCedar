import { sql } from "@/lib/db";
import type { LeadStatus } from "@/lib/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const VALID_STATUSES: LeadStatus[] = [
  "New",
  "GHL",
  "AlreadyInGHL",
  "Failed",
  "Lost",
  "Won",
];

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const leadId = Number(id);
  if (!Number.isFinite(leadId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const status =
    typeof body === "object" &&
    body !== null &&
    "status" in body &&
    typeof (body as { status: unknown }).status === "string"
      ? (body as { status: string }).status.trim()
      : "";

  if (!VALID_STATUSES.includes(status as LeadStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const rows = await sql`
  UPDATE leads
  SET status = ${status}
  WHERE id = ${leadId}
  RETURNING id, status
`;

  if (!rows.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const row = rows[0] as { id: number; status: LeadStatus };
  return NextResponse.json({ ok: true, id: row.id, status: row.status });
}
