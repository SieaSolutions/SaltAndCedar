import { sql } from "@/lib/db";
import type { LeadListFilters } from "@/lib/leadFilters";

export async function countLeads(f: LeadListFilters): Promise<number> {
  const rows = await sql`
    SELECT COUNT(*)::int AS c
    FROM leads
    WHERE (${f.status}::text IS NULL OR status = ${f.status})
      AND (${f.cityLike}::text IS NULL OR city ILIKE ${f.cityLike})
      AND (${f.stateLike}::text IS NULL OR state ILIKE ${f.stateLike})
      AND (${f.fromDate}::date IS NULL OR (date_scraped AT TIME ZONE 'America/New_York')::date >= ${f.fromDate}::date)
      AND (${f.toDate}::date IS NULL OR (date_scraped AT TIME ZONE 'America/New_York')::date <= ${f.toDate}::date)
      AND (
        ${f.searchText}::text IS NULL
        OR owner_name ILIKE '%' || ${f.searchText} || '%'
        OR (${f.searchDigits}::text IS NOT NULL AND owner_number LIKE '%' || ${f.searchDigits} || '%')
      )
  `;
  return Number((rows[0] as { c: number }).c ?? 0);
}

export async function listLeads(
  f: LeadListFilters,
  limit: number,
  offset: number,
) {
  return sql`
    SELECT id, owner_name, first_name, last_name, owner_number, owner_email, status,
           address, city, state, zipcode, beds, baths, rent_price,
           url, zid, date_scraped::text, created_at::text
    FROM leads
    WHERE (${f.status}::text IS NULL OR status = ${f.status})
      AND (${f.cityLike}::text IS NULL OR city ILIKE ${f.cityLike})
      AND (${f.stateLike}::text IS NULL OR state ILIKE ${f.stateLike})
      AND (${f.fromDate}::date IS NULL OR (date_scraped AT TIME ZONE 'America/New_York')::date >= ${f.fromDate}::date)
      AND (${f.toDate}::date IS NULL OR (date_scraped AT TIME ZONE 'America/New_York')::date <= ${f.toDate}::date)
      AND (
        ${f.searchText}::text IS NULL
        OR owner_name ILIKE '%' || ${f.searchText} || '%'
        OR (${f.searchDigits}::text IS NOT NULL AND owner_number LIKE '%' || ${f.searchDigits} || '%')
      )
    ORDER BY created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;
}

/** CSV export — full filtered list (cap 50k rows). */
export async function exportLeadsRows(f: LeadListFilters, maxRows = 50_000) {
  return sql`
    SELECT id, owner_name, owner_number, owner_email, address, city, state,
           beds, baths, rent_price, status, date_scraped::text
    FROM leads
    WHERE (${f.status}::text IS NULL OR status = ${f.status})
      AND (${f.cityLike}::text IS NULL OR city ILIKE ${f.cityLike})
      AND (${f.stateLike}::text IS NULL OR state ILIKE ${f.stateLike})
      AND (${f.fromDate}::date IS NULL OR (date_scraped AT TIME ZONE 'America/New_York')::date >= ${f.fromDate}::date)
      AND (${f.toDate}::date IS NULL OR (date_scraped AT TIME ZONE 'America/New_York')::date <= ${f.toDate}::date)
      AND (
        ${f.searchText}::text IS NULL
        OR owner_name ILIKE '%' || ${f.searchText} || '%'
        OR (${f.searchDigits}::text IS NOT NULL AND owner_number LIKE '%' || ${f.searchDigits} || '%')
      )
    ORDER BY created_at DESC
    LIMIT ${maxRows}
  `;
}
