import { importLeads } from "@/lib/importLeads";
import type { ImportRow } from "@/lib/importLeads";
import { MAPPABLE_FIELDS } from "@/lib/importMapping";
import { log } from "@/lib/log";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ROWS = 25_000;
const ALLOWED = new Set<string>(MAPPABLE_FIELDS);

export async function POST(req: Request) {
  const import_id =
    globalThis.crypto?.randomUUID?.() ?? `imp_${Date.now()}`;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Body must be valid JSON" },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body must be an object" }, { status: 400 });
  }

  const raw = (body as { rows?: unknown }).rows;
  if (!Array.isArray(raw)) {
    return NextResponse.json(
      { error: "`rows` must be an array" },
      { status: 400 },
    );
  }
  if (raw.length === 0) {
    return NextResponse.json(
      { error: "`rows` array is empty" },
      { status: 400 },
    );
  }
  if (raw.length > MAX_ROWS) {
    return NextResponse.json(
      {
        error: `Too many rows (${raw.length}). Max ${MAX_ROWS} per upload — split the file.`,
      },
      { status: 413 },
    );
  }

  const rows: ImportRow[] = [];
  let hasAnyPhone = false;

  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    if (!r || typeof r !== "object" || Array.isArray(r)) {
      return NextResponse.json(
        { error: `Row ${i} is not an object` },
        { status: 400 },
      );
    }
    const safe: ImportRow = {};
    for (const [k, v] of Object.entries(r as Record<string, unknown>)) {
      if (!ALLOWED.has(k)) continue;
      if (v === null || v === undefined) {
        safe[k] = null;
        continue;
      }
      // Cells must be strings (CSV cells); coerce numbers to be safe.
      safe[k] =
        typeof v === "string"
          ? v
          : typeof v === "number" || typeof v === "boolean"
            ? String(v)
            : null;
    }
    if (typeof safe.owner_number === "string" && safe.owner_number.trim()) {
      hasAnyPhone = true;
    }
    rows.push(safe);
  }

  if (!hasAnyPhone) {
    return NextResponse.json(
      {
        error:
          "No rows have a value for owner_number. Map a phone column and try again.",
      },
      { status: 400 },
    );
  }

  log.info("import.started", { import_id, rows: rows.length });

  try {
    const summary = await importLeads(rows, { import_id });
    return NextResponse.json({ ok: true, import_id, ...summary });
  } catch (e) {
    log.error("import.failed", e, { import_id });
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
