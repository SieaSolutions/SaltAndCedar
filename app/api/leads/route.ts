import { parseLeadFilters } from "@/lib/leadFilters";
import { countLeads, listLeads } from "@/lib/leadQueries";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const f = parseLeadFilters(sp);

    const page = Math.max(1, Number(sp.get("page") ?? "1") || 1);
    const pageSizeRaw = Number(sp.get("pageSize") ?? "20") || 20;
    const pageSize = Math.min(100, Math.max(1, pageSizeRaw));

    const offset = (page - 1) * pageSize;

    const [total, rows] = await Promise.all([
      countLeads(f),
      listLeads(f, pageSize, offset),
    ]);

    return NextResponse.json({
      page,
      pageSize,
      total,
      leads: rows,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
