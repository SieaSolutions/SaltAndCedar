import { parseLeadFilters } from "@/lib/leadFilters";
import { exportLeadsRows } from "@/lib/leadQueries";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const f = parseLeadFilters(sp);

  const rows = await exportLeadsRows(f);

  const header = [
    "id",
    "owner_name",
    "owner_number",
    "owner_email",
    "address",
    "city",
    "state",
    "beds",
    "baths",
    "rent_price",
    "status",
    "date_scraped",
  ];

  const lines = [
    header.join(","),
    ...(rows as Record<string, unknown>[]).map((r) =>
      [
        csvEscape(r.id),
        csvEscape(r.owner_name),
        csvEscape(r.owner_number),
        csvEscape(r.owner_email),
        csvEscape(r.address),
        csvEscape(r.city),
        csvEscape(r.state),
        csvEscape(r.beds),
        csvEscape(r.baths),
        csvEscape(r.rent_price),
        csvEscape(r.status),
        csvEscape(r.date_scraped),
      ].join(","),
    ),
  ];

  const csv = lines.join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-export.csv"`,
    },
  });
}
