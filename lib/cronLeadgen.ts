import { randomUUID } from "crypto";
import { sql } from "@/lib/db";
import { runOneCity } from "@/lib/leadgenPipeline";
import { log } from "@/lib/log";
import type { RunRow, SettingsRow } from "@/lib/types";

async function loadSettings(): Promise<SettingsRow | null> {
  const rows = await sql`
    SELECT id, daily_target, cities, min_rent, min_beds, is_furnished, days_back, max_results_per_city
    FROM settings WHERE id = 1 LIMIT 1
  `;
  return (rows[0] as unknown as SettingsRow) ?? null;
}

async function staleSweepLeadgen(): Promise<number> {
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

async function findOrCreateLeadgenRun(daily_target: number): Promise<RunRow> {
  const existing = await sql`
    SELECT id, type, started_at::text, completed_at::text, status, target, leads_found, leads_sent, cities_processed
    FROM runs
    WHERE type = 'leadgen'
      AND status IN ('running', 'completed')
      AND ((started_at AT TIME ZONE 'America/New_York')::date)
          = ((NOW() AT TIME ZONE 'America/New_York')::date)
    LIMIT 1
  `;
  if (existing.length) return existing[0] as unknown as RunRow;

  try {
    const ins = await sql`
      INSERT INTO runs (type, started_at, completed_at, status, target, leads_found, leads_sent, cities_processed)
      VALUES ('leadgen', NOW(), NULL, 'running', ${daily_target}, 0, NULL, '{}'::text[])
      RETURNING id, type, started_at::text, completed_at::text, status, target, leads_found, leads_sent, cities_processed
    `;
    log.info("runs.created", {
      run_id: (ins[0] as unknown as RunRow).id,
      type: "leadgen",
    });
    return ins[0] as unknown as RunRow;
  } catch (e: unknown) {
    const code = (e as { code?: string }).code;
    if (code !== "23505") throw e;
    const again = await sql`
      SELECT id, type, started_at::text, completed_at::text, status, target, leads_found, leads_sent, cities_processed
      FROM runs
      WHERE type = 'leadgen'
        AND status IN ('running', 'completed')
        AND ((started_at AT TIME ZONE 'America/New_York')::date)
            = ((NOW() AT TIME ZONE 'America/New_York')::date)
      LIMIT 1
    `;
    return again[0] as unknown as RunRow;
  }
}

export type LeadgenTickOutcome =
  | {
      ok: true;
      tick_id: string;
      skipped?: string;
      run_id?: number;
      city?: string;
      inserted?: number;
      completed?: boolean;
    }
  | { ok: false; tick_id: string; error: string };

export async function runLeadgenTick(): Promise<LeadgenTickOutcome> {
  const tick_id = randomUUID();
  log.info("tick.started", { tick_id });

  try {
    const swept = await staleSweepLeadgen();
    if (swept > 0) log.info("runs.stale_swept", { tick_id, count: swept });

    const settings = await loadSettings();
    if (!settings) {
      log.warn("tick.skipped", { tick_id, reason: "no_settings" });
      return { ok: true, tick_id, skipped: "no_settings" };
    }

    const cities = settings.cities ?? [];
    if (!cities.length) {
      log.warn("tick.skipped", { tick_id, reason: "no_cities" });
      return { ok: true, tick_id, skipped: "no_cities" };
    }

    const target = settings.daily_target ?? 200;
    const run = await findOrCreateLeadgenRun(target);
    log.info("runs.found", { tick_id, run_id: run.id, status: run.status });

    if (run.status === "completed") {
      log.info("tick.skipped", { tick_id, run_id: run.id, reason: "already_completed" });
      return {
        ok: true,
        tick_id,
        skipped: "already_completed",
        run_id: run.id,
      };
    }

    const processed = new Set(run.cities_processed ?? []);
    const remaining = cities.filter((c) => !processed.has(c));

    const leads_found = Number(run.leads_found ?? 0);
    if (leads_found >= target || remaining.length === 0) {
      await sql`
        UPDATE runs SET status = 'completed', completed_at = NOW()
        WHERE id = ${run.id}
      `;
      log.info("tick.completed", {
        tick_id,
        run_id: run.id,
        reason: "target_or_no_cities",
        leads_found,
      });
      return {
        ok: true,
        tick_id,
        completed: true,
        run_id: run.id,
      };
    }

    const next_city = remaining[0];
    log.info("tick.city_selected", {
      tick_id,
      run_id: run.id,
      city: next_city,
      target,
      leads_found,
      processed_count: processed.size,
      remaining_count: remaining.length,
    });

    let inserted = 0;
    try {
      const result = await runOneCity(next_city, settings, run.id, tick_id);
      inserted = result.inserted;
    } catch (e) {
      log.error("tick.error", e, {
        tick_id,
        run_id: run.id,
        city: next_city,
      });
      inserted = 0;
    }

    await sql`
      UPDATE runs SET
        cities_processed = CASE
          WHEN ${next_city} = ANY(cities_processed) THEN cities_processed
          ELSE array_append(cities_processed, ${next_city})
        END,
        leads_found = COALESCE(leads_found, 0) + ${inserted}
      WHERE id = ${run.id}
    `;

    const updated = await sql`
      SELECT leads_found, cities_processed
      FROM runs WHERE id = ${run.id} LIMIT 1
    `;
    const newFound = Number((updated[0] as { leads_found: number }).leads_found ?? 0);
    const newProcessed =
      (updated[0] as { cities_processed: string[] }).cities_processed ?? [];

    const done =
      newFound >= target ||
      cities.every((c) => newProcessed.includes(c));

    if (done) {
      await sql`
        UPDATE runs SET status = 'completed', completed_at = NOW()
        WHERE id = ${run.id}
      `;
    }

    log.info("tick.completed", {
      tick_id,
      run_id: run.id,
      city: next_city,
      inserted,
      leads_found_after: newFound,
      day_completed: done,
    });

    return {
      ok: true,
      tick_id,
      run_id: run.id,
      city: next_city,
      inserted,
      completed: done,
    };
  } catch (e) {
    log.error("tick.error", e, { tick_id });
    return {
      ok: false,
      tick_id,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Manual “process all remaining cities until target” — loops ticks with a safety cap. */
export async function runLeadgenUntilDone(maxIterations = 40): Promise<{
  iterations: number;
  total_inserted: number;
  outcomes: LeadgenTickOutcome[];
}> {
  const outcomes: LeadgenTickOutcome[] = [];
  let total_inserted = 0;
  let iterations = 0;

  while (iterations < maxIterations) {
    iterations++;
    const o = await runLeadgenTick();
    outcomes.push(o);
    if (!o.ok) break;
    if (o.skipped === "no_settings" || o.skipped === "no_cities") break;
    if (o.skipped === "already_completed") break;
    total_inserted += o.inserted ?? 0;
    if (o.completed) break;
  }

  return { iterations, total_inserted, outcomes };
}
