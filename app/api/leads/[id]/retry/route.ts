import { sql } from "@/lib/db";
import { sendLeadToGhl } from "@/lib/ghl";
import { log } from "@/lib/log";
import type { LeadRow } from "@/lib/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const leadId = Number(id);
  if (!Number.isFinite(leadId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const rows = await sql`
    SELECT id, first_name, last_name, owner_number, owner_email, address, city, state, zipcode,
           beds, baths, rent_price, url, zid, status
    FROM leads WHERE id = ${leadId} LIMIT 1
  `;

  if (!rows.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const lead = rows[0] as unknown as LeadRow & { status: string };

  if (lead.status !== "Failed") {
    return NextResponse.json(
      { error: "Only Failed leads can be retried" },
      { status: 400 },
    );
  }

  const started = Date.now();
  const result = await sendLeadToGhl(lead);
  const elapsed_ms = Date.now() - started;

  if (result.ok) {
    await sql`
      UPDATE leads SET status = 'GHL', ghl_sent_at = NOW()
      WHERE id = ${leadId}
    `;
    log.info("ghl.sent", { lead_id: leadId, elapsed_ms, retry: true });
    return NextResponse.json({ ok: true, status: "GHL" });
  }

  await sql`
    UPDATE leads SET status = 'Failed'
    WHERE id = ${leadId}
  `;
  log.warn("ghl.failed", {
    lead_id: leadId,
    elapsed_ms,
    retry: true,
    http_status: result.http_status,
    error_message: result.error_message?.slice(0, 300),
  });

  return NextResponse.json(
    { ok: false, status: "Failed", detail: result.error_message },
    { status: 502 },
  );
}
