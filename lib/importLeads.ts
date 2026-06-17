import { sql } from "@/lib/db";
import type { Candidate } from "@/lib/filters";
import { evaluateCandidate, summarizeReasons } from "@/lib/filters";
import { log } from "@/lib/log";
import { splitOwnerName } from "@/lib/nameParser";
import { normalizePhone } from "@/lib/phone";

export {
  MAPPABLE_FIELDS,
  HEADER_SYNONYMS,
  FIELD_LABELS,
  normalizeHeader,
  suggestField,
} from "@/lib/importMapping";
export type { MappableField, Mapping } from "@/lib/importMapping";

export interface ImportRow {
  /** Mapped field name -> raw cell value. Unmapped CSV columns are dropped client-side. */
  [field: string]: string | null | undefined;
}

export interface ImportSummary {
  total: number;
  inserted: number;
  skipped: number;
  by_reason: { reason: string; count: number }[];
}

const INSERT_BATCH = 500;

/** Coerce a CSV cell to a number. Returns null for blank or non-numeric input. */
function toNumber(v: string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  if (!t) return null;
  // Strip $ , and whitespace; tolerate "1,200" or "$1,200.00"
  const cleaned = t.replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function trimOrNull(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  return t.length ? t : null;
}

/**
 * Run a CSV import through the same filter + dedupe pipeline used for
 * scraped leads. Inserts survivors with status='New', source='CSV Import'.
 */
export async function importLeads(
  rows: ImportRow[],
  ctx: { import_id: string; source: string },
): Promise<ImportSummary> {
  const total = rows.length;
  const reasonCounts = new Map<string, number>();

  const candidates: Candidate[] = rows.map((r) => {
    const ownerNameRaw = trimOrNull(r.owner_name);
    const firstFromRow = trimOrNull(r.first_name);
    const lastFromRow = trimOrNull(r.last_name);

    let owner_name: string | null = ownerNameRaw;
    if (!owner_name && (firstFromRow || lastFromRow)) {
      owner_name = [firstFromRow, lastFromRow].filter(Boolean).join(" ").trim() || null;
    }

    return {
      zpid: trimOrNull(r.zid) ?? "",
      addressLine: trimOrNull(r.address) ?? "",
      city: trimOrNull(r.city) ?? "",
      state: trimOrNull(r.state) ?? "",
      zipcode: trimOrNull(r.zipcode) ?? "",
      lat: null,
      long: null,
      beds: toNumber(r.beds),
      baths: toNumber(r.baths),
      rent_price: toNumber(r.rent_price),
      url: trimOrNull(r.url),
      listingDateRaw: null,
      displayName: owner_name,
      businessName: null,
      phoneRaw: trimOrNull(r.owner_number),
      phoneTypeRaw: trimOrNull(r.phone_type),
      tracerfy_email: null,
      owner_name,
      owner_email: trimOrNull(r.owner_email),
      // Carry forward explicit first/last from the CSV when provided so we
      // don't lose them if owner_name happens to be a single token.
      _firstFromRow: firstFromRow,
      _lastFromRow: lastFromRow,
    } as Candidate & {
      _firstFromRow: string | null;
      _lastFromRow: string | null;
    };
  });

  const distinctPhones = [
    ...new Set(
      candidates
        .map((c) => normalizePhone(c.phoneRaw))
        .filter((p) => p.length >= 10),
    ),
  ];

  const dupRows =
    distinctPhones.length === 0
      ? []
      : await sql`
          SELECT owner_number FROM leads
          WHERE owner_number = ANY(${distinctPhones})
        `;

  const dbPhones = new Set(
    (dupRows as { owner_number: string }[]).map((r) => r.owner_number),
  );

  const runPhones = new Set<string>();
  const survivors: (Candidate & {
    _firstFromRow?: string | null;
    _lastFromRow?: string | null;
  })[] = [];

  for (const c of candidates) {
    const ev = evaluateCandidate(c, {
      dbPhones,
      runPhones,
      requireMobile: true,
    });
    if (!ev.keep) {
      const r = ev.reason ?? "unknown";
      reasonCounts.set(r, (reasonCounts.get(r) ?? 0) + 1);
      continue;
    }
    runPhones.add(normalizePhone(c.phoneRaw));
    survivors.push(c);
  }

  log.info("import.filter.summary", {
    import_id: ctx.import_id,
    total,
    kept: survivors.length,
    dropped: total - survivors.length,
    by_reason: Object.fromEntries(reasonCounts),
    db_dup_hits: dbPhones.size,
  });

  let inserted = 0;
  for (let i = 0; i < survivors.length; i += INSERT_BATCH) {
    const slice = survivors.slice(i, i + INSERT_BATCH);
    inserted += await insertBatch(slice, ctx.source);
  }

  log.info("import.summary", {
    import_id: ctx.import_id,
    total,
    inserted,
    skipped: total - inserted,
    by_reason: Object.fromEntries(reasonCounts),
  });

  return {
    total,
    inserted,
    skipped: total - inserted,
    by_reason: summarizeReasons(reasonCounts),
  };
}

/**
 * Insert up to INSERT_BATCH rows. Uses UNNEST so the whole batch fits in a
 * single round-trip; that keeps imports of a few thousand rows snappy on
 * Vercel/Neon HTTP.
 */
async function insertBatch(
  rows: (Candidate & {
    _firstFromRow?: string | null;
    _lastFromRow?: string | null;
  })[],
  source: string,
): Promise<number> {
  if (!rows.length) return 0;

  const owner_names: (string | null)[] = [];
  const first_names: (string | null)[] = [];
  const last_names: (string | null)[] = [];
  const owner_numbers: string[] = [];
  const owner_emails: (string | null)[] = [];
  const addresses: (string | null)[] = [];
  const cities: (string | null)[] = [];
  const states: (string | null)[] = [];
  const zipcodes: (string | null)[] = [];
  const beds: (number | null)[] = [];
  const baths: (number | null)[] = [];
  const rent_prices: (number | null)[] = [];
  const urls: (string | null)[] = [];
  const zids: (string | null)[] = [];

  for (const s of rows) {
    const split = splitOwnerName(s.owner_name ?? "");
    const firstName = s._firstFromRow ?? split.first_name;
    const lastName = s._lastFromRow ?? split.last_name;
    const phone = normalizePhone(s.phoneRaw);

    owner_names.push(s.owner_name ?? null);
    first_names.push(firstName);
    last_names.push(lastName);
    owner_numbers.push(phone);
    owner_emails.push(s.owner_email ?? null);
    addresses.push(s.addressLine || null);
    cities.push(s.city || null);
    states.push(s.state || null);
    zipcodes.push(s.zipcode || null);
    beds.push(s.beds);
    baths.push(s.baths);
    rent_prices.push(s.rent_price);
    urls.push(s.url ?? null);
    zids.push(s.zpid || null);
  }

  await sql`
    INSERT INTO leads (
      owner_name, first_name, last_name, owner_number, owner_email,
      status, source, address, city, state, zipcode,
      beds, baths, rent_price, url, zid
    )
    SELECT
      owner_name, first_name, last_name, owner_number, owner_email,
      'New', ${source},
      address, city, state, zipcode,
      beds, baths, rent_price, url, zid
    FROM UNNEST(
      ${owner_names}::text[],
      ${first_names}::text[],
      ${last_names}::text[],
      ${owner_numbers}::text[],
      ${owner_emails}::text[],
      ${addresses}::text[],
      ${cities}::text[],
      ${states}::text[],
      ${zipcodes}::text[],
      ${beds}::numeric[],
      ${baths}::numeric[],
      ${rent_prices}::numeric[],
      ${urls}::text[],
      ${zids}::text[]
    ) AS t (
      owner_name, first_name, last_name, owner_number, owner_email,
      address, city, state, zipcode, beds, baths, rent_price, url, zid
    )
  `;

  return rows.length;
}
