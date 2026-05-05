import { randomUUID } from "crypto";
import { sql } from "@/lib/db";
import { sendLeadToGhl } from "@/lib/ghl";
import { log } from "@/lib/log";
import type { LeadRow } from "@/lib/types";
import { sleep } from "@/lib/runtime";

async function staleSweepGhlSameAsLeadgen(): Promise<number> {
  const swept = await sql`
    UPDATE runs SET status = 'failed', completed_at = COALESCE(completed_at, NOW())
    WHERE status = 'running'
      AND type IN ('leadgen', 'ghl')
      AND ((started_at AT TIME ZONE 'America/New_York')::date)
          < ((NOW() AT TIME ZONE 'America/New_York')::date)
    RETURNING id
  `;
  return swept.length;
}

export type GhlBatchOutcome =
  | {
      ok: true;
      tick_id: string;
      run_id: number;
      batch_size: number;
      leads_sent: number;
      attempts: number;
      skipped_empty?: boolean;
    }
  | { ok: false; tick_id: string; error: string };

export async function runGhlBatch(): Promise<GhlBatchOutcome> {
  const tick_id = randomUUID();
  log.info("ghl.batch.started", { tick_id });

  try {
    const swept = await staleSweepGhlSameAsLeadgen();
    if (swept > 0) log.info("runs.stale_swept", { tick_id, count: swept });

    const srows = await sql`
      SELECT daily_target FROM settings WHERE id = 1 LIMIT 1
    `;
    const daily_target = Number((srows[0] as { daily_target: number })?.daily_target ?? 200);
    const batch_size = Math.max(1, Math.ceil(daily_target / 4));

    const runIns = await sql`
      INSERT INTO runs (type, started_at, completed_at, status, target, leads_found, leads_sent, cities_processed)
      VALUES ('ghl', NOW(), NULL, 'running', ${batch_size}, NULL, 0, '{}'::text[])
      RETURNING id
    `;
    const run_id = (runIns[0] as { id: number }).id;

    const rows = await sql`
      SELECT id, first_name, last_name, owner_number, owner_email, address, city, state, zipcode,
             beds, baths, rent_price, url, zid
      FROM leads
      WHERE status = 'New'
      ORDER BY created_at ASC
      LIMIT ${batch_size}
    `;

    const leads = rows as unknown as LeadRow[];

    if (!leads.length) {
      await sql`
        UPDATE runs SET status = 'completed', completed_at = NOW(), leads_sent = 0
        WHERE id = ${run_id}
      `;
      log.info("ghl.batch.completed", {
        tick_id,
        run_id,
        leads_sent: 0,
        skipped_empty: true,
      });
      return {
        ok: true,
        tick_id,
        run_id,
        batch_size,
        leads_sent: 0,
        attempts: 0,
        skipped_empty: true,
      };
    }

    let leads_sent = 0;
    let attempts = 0;

    for (const lead of leads) {
      attempts++;
      const started = Date.now();
      const result = await sendLeadToGhl(lead);
      const elapsed_ms = Date.now() - started;

      if (result.ok) {
        await sql`
          UPDATE leads SET status = 'GHL', ghl_sent_at = NOW()
          WHERE id = ${lead.id}
        `;
        leads_sent++;
        log.info("ghl.sent", {
          tick_id,
          run_id,
          lead_id: lead.id,
          elapsed_ms,
          http_status: result.http_status,
        });
      } else {
        await sql`
          UPDATE leads SET status = 'Failed'
          WHERE id = ${lead.id}
        `;
        log.warn("ghl.failed", {
          tick_id,
          run_id,
          lead_id: lead.id,
          elapsed_ms,
          http_status: result.http_status,
          error_message: result.error_message?.slice(0, 300),
        });
      }

      await sleep(150);
    }

    const finalStatus =
      leads_sent === 0 && attempts > 0 ? "failed" : "completed";

    await sql`
      UPDATE runs SET status = ${finalStatus}, completed_at = NOW(), leads_sent = ${leads_sent}
      WHERE id = ${run_id}
    `;

    log.info("ghl.batch.completed", {
      tick_id,
      run_id,
      leads_sent,
      attempts,
      final_status: finalStatus,
    });

    return {
      ok: true,
      tick_id,
      run_id,
      batch_size,
      leads_sent,
      attempts,
    };
  } catch (e) {
    log.error("tick.error", e, { tick_id, route: "ghl" });
    return {
      ok: false,
      tick_id,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
