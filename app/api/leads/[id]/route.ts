import { sql } from "@/lib/db";
import { LEAD_SOURCES, LEAD_STATUSES, type LeadSource, type LeadStatus } from "@/lib/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

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

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  if ("status" in b) {
    const status = typeof b.status === "string" ? b.status.trim() : "";
    if (!LEAD_STATUSES.includes(status as LeadStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    const rows = await sql`
      UPDATE leads SET status = ${status} WHERE id = ${leadId}
      RETURNING id, status
    `;
    if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const row = rows[0] as { id: number; status: LeadStatus };
    return NextResponse.json({ ok: true, id: row.id, status: row.status });
  }

  if ("source" in b) {
    const source = typeof b.source === "string" ? b.source.trim() : "";
    if (!LEAD_SOURCES.includes(source as LeadSource)) {
      return NextResponse.json({ error: "Invalid source" }, { status: 400 });
    }
    const rows = await sql`
      UPDATE leads SET source = ${source} WHERE id = ${leadId}
      RETURNING id, source
    `;
    if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const row = rows[0] as { id: number; source: LeadSource };
    return NextResponse.json({ ok: true, id: row.id, source: row.source });
  }

  return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
}
