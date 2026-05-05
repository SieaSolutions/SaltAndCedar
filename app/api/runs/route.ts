import { sql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type");

  const rows =
    type === "leadgen" || type === "ghl"
      ? await sql`
          SELECT id, type, started_at::text, completed_at::text, status,
                 target, leads_found, leads_sent, cities_processed
          FROM runs
          WHERE type = ${type}
          ORDER BY started_at DESC
          LIMIT 200
        `
      : await sql`
          SELECT id, type, started_at::text, completed_at::text, status,
                 target, leads_found, leads_sent, cities_processed
          FROM runs
          ORDER BY started_at DESC
          LIMIT 200
        `;

  return NextResponse.json({ runs: rows });
}
