import { sql } from "@/lib/db";
import { ApifyError, runPhoneScraper, runZillowScraper } from "@/lib/apify";
import type { Candidate } from "@/lib/filters";
import { evaluateCandidate, summarizeReasons } from "@/lib/filters";
import { log } from "@/lib/log";
import { splitOwnerName } from "@/lib/nameParser";
import { normalizePhone } from "@/lib/phone";
import type { ListingMerged, SettingsRow } from "@/lib/types";
import { enrichMissingPhonesTracerfy } from "@/lib/tracerfy";

export async function runOneCity(
  city: string,
  settings: SettingsRow,
  run_id: number,
  tick_id: string,
): Promise<{
  inserted: number;
  raw: number;
  filtered_out: { reason: string; count: number }[];
}> {
  const endTimer = log.timer("pipeline.city.completed", {
    city,
    run_id,
    tick_id,
  });
  log.info("pipeline.city.started", { city, run_id, tick_id });

  let listings: ListingMerged[];
  try {
    listings = await runZillowScraper(city, settings);
  } catch (e) {
    log.error("apify.actor1.failed", e, { city, run_id, tick_id });
    if (e instanceof ApifyError) throw e;
    throw new ApifyError(String(e), "actor1");
  }

  if (!listings.length) {
    log.info("pipeline.city.empty", { city, run_id, tick_id });
    endTimer();
    return { inserted: 0, raw: 0, filtered_out: [] };
  }

  const zpids = [...new Set(listings.map((l) => l.zpid))];

  let phoneMap: Awaited<ReturnType<typeof runPhoneScraper>>;
  try {
    phoneMap = await runPhoneScraper(zpids, city);
  } catch (e) {
    log.warn("apify.actor2.failed", {
      city,
      run_id,
      tick_id,
      error_message: e instanceof Error ? e.message : String(e),
    });
    phoneMap = new Map();
  }

  for (const listing of listings) {
    const c = phoneMap.get(listing.zpid);
    if (c) {
      listing.displayName = c.displayName;
      listing.businessName = c.businessName;
      listing.phoneRaw = c.phoneNumber;
    }
  }

  await enrichMissingPhonesTracerfy(listings, { tick_id, run_id, city });

  const candidates: Candidate[] = listings.map((listing) => {
    const owner_name =
      listing.displayName?.trim() ||
      listing.businessName?.trim() ||
      null;
    return {
      ...listing,
      owner_name,
      owner_email: listing.tracerfy_email ?? null,
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
  const reasonCounts = new Map<string, number>();
  const survivors: Candidate[] = [];

  for (const c of candidates) {
    const ev = evaluateCandidate(c, { dbPhones, runPhones });
    if (!ev.keep) {
      const r = ev.reason ?? "unknown";
      reasonCounts.set(r, (reasonCounts.get(r) ?? 0) + 1);
      continue;
    }
    const phone = normalizePhone(c.phoneRaw);
    runPhones.add(phone);
    survivors.push(c);
  }

  log.info("filter.summary", {
    city,
    run_id,
    tick_id,
    raw: candidates.length,
    kept: survivors.length,
    dropped: candidates.length - survivors.length,
    by_reason: Object.fromEntries(reasonCounts),
  });

  log.info("dedupe.summary", {
    city,
    run_id,
    tick_id,
    phones_checked_against_db: distinctPhones.length,
    db_hits_prior_to_insert: dupRows.length,
    survivors_after_filters: survivors.length,
  });

  let inserted = 0;
  for (const s of survivors) {
    const { first_name, last_name } = splitOwnerName(s.owner_name ?? "");
    const phone = normalizePhone(s.phoneRaw);
    await sql`
      INSERT INTO leads (
        owner_name, first_name, last_name, owner_number, owner_email,
        status, source, address, city, state, zipcode,
        beds, baths, rent_price, lat, long, url, zid
      ) VALUES (
        ${s.owner_name},
        ${first_name},
        ${last_name},
        ${phone},
        ${s.owner_email},
        'New',
        'Zillow',
        ${s.addressLine},
        ${s.city},
        ${s.state},
        ${s.zipcode},
        ${s.beds},
        ${s.baths},
        ${s.rent_price},
        ${s.lat},
        ${s.long},
        ${s.url},
        ${s.zpid}
      )
    `;
    inserted++;
  }

  log.info("leads.inserted", {
    city,
    run_id,
    tick_id,
    count: inserted,
  });

  endTimer();
  return {
    inserted,
    raw: candidates.length,
    filtered_out: summarizeReasons(reasonCounts),
  };
}
