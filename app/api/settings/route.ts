import { sql } from "@/lib/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function finiteNum(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export async function GET() {
  const rows = await sql`
    SELECT id, daily_target, cities, min_rent, min_beds, is_furnished, days_back, max_results_per_city
    FROM settings WHERE id = 1 LIMIT 1
  `;
  if (!rows.length) {
    return NextResponse.json({ error: "Settings missing" }, { status: 500 });
  }
  return NextResponse.json(rows[0]);
}

export async function PUT(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  const daily_target = finiteNum(b.daily_target);
  const min_rent = finiteNum(b.min_rent);
  const min_beds = finiteNum(b.min_beds);
  const days_back = finiteNum(b.days_back);
  const max_results_per_city = finiteNum(b.max_results_per_city);

  if (
    daily_target === undefined ||
    min_rent === undefined ||
    min_beds === undefined ||
    days_back === undefined ||
    max_results_per_city === undefined
  ) {
    return NextResponse.json({ error: "Missing numeric fields" }, { status: 400 });
  }

  if (!Array.isArray(b.cities)) {
    return NextResponse.json({ error: "cities must be an array" }, { status: 400 });
  }

  const cities = (b.cities as unknown[])
    .map((c) => String(c).trim())
    .filter(Boolean);

  const is_furnished =
    typeof b.is_furnished === "boolean" ? b.is_furnished : Boolean(b.is_furnished);

  await sql`
    UPDATE settings SET
      daily_target = ${Math.max(1, Math.floor(daily_target))},
      cities = ${cities},
      min_rent = ${min_rent},
      min_beds = ${Math.max(0, Math.floor(min_beds))},
      is_furnished = ${is_furnished},
      days_back = ${Math.max(1, Math.floor(days_back))},
      max_results_per_city = ${Math.max(1, Math.floor(max_results_per_city))}
    WHERE id = 1
  `;

  const rows = await sql`
    SELECT id, daily_target, cities, min_rent, min_beds, is_furnished, days_back, max_results_per_city
    FROM settings WHERE id = 1 LIMIT 1
  `;

  return NextResponse.json(rows[0]);
}
