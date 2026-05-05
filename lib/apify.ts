import { log } from "@/lib/log";
import type { ListingMerged, SettingsRow } from "@/lib/types";

export class ApifyError extends Error {
  constructor(
    message: string,
    public readonly actor: "actor1" | "actor2",
    public readonly httpStatus?: number,
  ) {
    super(message);
    this.name = "ApifyError";
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(
  url: string,
  body: unknown,
  opts: { timeoutMs: number; actor: "actor1" | "actor2"; city?: string },
): Promise<unknown[]> {
  let attempt = 0;
  while (attempt < 2) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), opts.timeoutMs);
    const started = Date.now();
    try {
      log.info(`apify.${opts.actor}.start`, {
        city: opts.city,
        attempt,
      });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      const elapsed_ms = Date.now() - started;
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        if ((res.status >= 500 || res.status === 429) && attempt === 0) {
          log.warn(`apify.${opts.actor}.retry`, {
            city: opts.city,
            http_status: res.status,
            body_preview: txt.slice(0, 300),
          });
          attempt++;
          await sleep(2000);
          continue;
        }
        log.warn(`apify.${opts.actor}.failed`, {
          city: opts.city,
          http_status: res.status,
          elapsed_ms,
          body_preview: txt.slice(0, 300),
        });
        throw new ApifyError(
          `Apify HTTP ${res.status}`,
          opts.actor,
          res.status,
        );
      }
      const json = (await res.json()) as unknown;
      const items = Array.isArray(json) ? json : [];
      log.info(`apify.${opts.actor}.success`, {
        city: opts.city,
        elapsed_ms,
        item_count: items.length,
      });
      return items;
    } catch (e) {
      clearTimeout(t);
      const elapsed_ms = Date.now() - started;
      const isAbort = e instanceof Error && e.name === "AbortError";
      const retryable =
        attempt === 0 &&
        (isAbort ||
          e instanceof TypeError ||
          (e instanceof ApifyError && e.httpStatus && e.httpStatus >= 500));
      if (retryable) {
        log.warn(`apify.${opts.actor}.retry`, {
          city: opts.city,
          attempt,
          elapsed_ms,
          error_name: e instanceof Error ? e.name : typeof e,
        });
        attempt++;
        await sleep(2000);
        continue;
      }
      log.error(`apify.${opts.actor}.failed`, e, {
        city: opts.city,
        elapsed_ms,
      });
      throw e instanceof ApifyError
        ? e
        : new ApifyError(String(e), opts.actor);
    }
  }
  throw new ApifyError("Apify exhausted retries", opts.actor);
}

export async function runZillowScraper(
  city: string,
  settings: SettingsRow,
): Promise<ListingMerged[]> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new ApifyError("APIFY_API_TOKEN missing", "actor1");

  const url =
    `https://api.apify.com/v2/acts/7EG6vc4LOoouPfk3t/run-sync-get-dataset-items` +
    `?token=${encodeURIComponent(token)}`;

  const body = {
    furnished: [settings.is_furnished],
    homeTypes: ["houses", "townhomes"],
    location: city,
    minBeds: [settings.min_beds],
    minPrice: [Number(settings.min_rent)],
    operation: "rent",
    ownerPosted: true,
    space: "entirePlace",
    timeOnZillow: `${settings.days_back}d`,
  };

  const items = await fetchWithRetry(url, body, {
    timeoutMs: 240_000,
    actor: "actor1",
    city,
  });

  const out: ListingMerged[] = [];
  for (const raw of items) {
    const parsed = parseListing(raw);
    if (!parsed) {
      log.warn("apify.parse_skip", { city, reason: "listing_shape" });
      continue;
    }
    out.push(parsed);
  }
  return out;
}

export async function runPhoneScraper(
  zpids: string[],
  city: string,
): Promise<Map<string, { displayName: string | null; businessName: string | null; phoneNumber: string | null }>> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new ApifyError("APIFY_API_TOKEN missing", "actor2");

  const url =
    `https://api.apify.com/v2/acts/18TsPuKUHiy49Y10E/run-sync-get-dataset-items` +
    `?token=${encodeURIComponent(token)}`;

  const items = await fetchWithRetry(
    url,
    { zpids: zpids.map((z) => String(z)) },
    { timeoutMs: 180_000, actor: "actor2", city },
  );

  const map = new Map<
    string,
    {
      displayName: string | null;
      businessName: string | null;
      phoneNumber: string | null;
    }
  >();

  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const zpid =
      o.zpid !== undefined && o.zpid !== null ? String(o.zpid) : null;
    if (!zpid) continue;
    map.set(zpid, {
      displayName:
        typeof o.displayName === "string" ? o.displayName : null,
      businessName:
        typeof o.businessName === "string" ? o.businessName : null,
      phoneNumber:
        typeof o.phoneNumber === "string" ? o.phoneNumber : null,
    });
  }

  return map;
}

function parseListing(raw: unknown): ListingMerged | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const zpid = r.zpid != null ? String(r.zpid) : null;
  if (!zpid) return null;

  const addr =
    r.address && typeof r.address === "object"
      ? (r.address as Record<string, unknown>)
      : {};

  const city = typeof addr.city === "string" ? addr.city : null;
  const state = typeof addr.state === "string" ? addr.state : null;
  const zipcode =
    typeof addr.zipcode === "string"
      ? addr.zipcode
      : typeof addr.zipCode === "string"
        ? addr.zipCode
        : null;
  const street =
    typeof addr.streetAddress === "string"
      ? addr.streetAddress
      : typeof addr.street === "string"
        ? addr.street
        : null;

  if (!city || !state || !zipcode || !street) return null;

  const loc =
    r.location && typeof r.location === "object"
      ? (r.location as Record<string, unknown>)
      : {};

  const lat =
    typeof loc.latitude === "number"
      ? loc.latitude
      : typeof loc.latitude === "string"
        ? Number(loc.latitude)
        : null;
  const long =
    typeof loc.longitude === "number"
      ? loc.longitude
      : typeof loc.longitude === "string"
        ? Number(loc.longitude)
        : null;

  const beds =
    typeof r.bedrooms === "number"
      ? r.bedrooms
      : typeof r.bedrooms === "string"
        ? Number(r.bedrooms)
        : null;

  const baths =
    typeof r.bathrooms === "number"
      ? r.bathrooms
      : typeof r.bathrooms === "string"
        ? Number(r.bathrooms)
        : null;

  const priceObj =
    r.price && typeof r.price === "object"
      ? (r.price as Record<string, unknown>)
      : null;
  const rent_price =
    priceObj && typeof priceObj.value === "number"
      ? priceObj.value
      : priceObj && typeof priceObj.value === "string"
        ? Number(priceObj.value)
        : typeof r.price === "number"
          ? r.price
          : null;

  const url = typeof r.url === "string" ? r.url : null;

  const listingDateRaw =
    typeof r.listingDateTimeOnZillow === "string"
      ? r.listingDateTimeOnZillow
      : typeof r.listingDateTime === "string"
        ? r.listingDateTime
        : null;

  return {
    zpid,
    addressLine: street,
    city,
    state,
    zipcode,
    lat: Number.isFinite(lat as number) ? (lat as number) : null,
    long: Number.isFinite(long as number) ? (long as number) : null,
    beds: Number.isFinite(beds as number) ? (beds as number) : null,
    baths: Number.isFinite(baths as number) ? (baths as number) : null,
    rent_price:
      rent_price !== null && Number.isFinite(rent_price)
        ? rent_price
        : null,
    url,
    listingDateRaw,
    displayName: null,
    businessName: null,
    phoneRaw: null,
  };
}
