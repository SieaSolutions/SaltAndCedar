import type { LeadRow } from "@/lib/types";

export interface GhlSendResult {
  ok: boolean;
  http_status?: number;
  error_message?: string;
}

const GHL_VERSION = "2021-07-28";
const GHL_BASE = "https://services.leadconnectorhq.com";

type LeadForGhl = Pick<
  LeadRow,
  | "first_name"
  | "last_name"
  | "owner_number"
  | "owner_email"
  | "address"
  | "city"
  | "state"
  | "zipcode"
  | "beds"
  | "baths"
  | "rent_price"
  | "url"
  | "zid"
>;

interface GhlCustomField {
  id: string;
  value: string | number;
}

function pushField(
  out: GhlCustomField[],
  id: string | undefined,
  value: string | number | null | undefined,
) {
  if (!id || value === null || value === undefined || value === "") return;
  out.push({ id, value });
}

export function buildGhlPayload(lead: LeadForGhl, opts?: { listName?: string }) {
  const customFields: GhlCustomField[] = [];

  // Field IDs discovered from the user's GHL location; env overrides supported.
  pushField(
    customFields,
    process.env.GHL_CF_LIST_ID ?? "KUiV5snTEs2x99jwPAv8",
    opts?.listName,
  );
  pushField(
    customFields,
    process.env.GHL_CF_BEDROOMS_ID ?? "NKFU2Wl22ucnacfTIuzc",
    lead.beds != null ? Number(lead.beds) : null,
  );
  pushField(
    customFields,
    process.env.GHL_CF_BATHROOMS_ID ?? "TL35ZPBxjbuzOYCxAUsd",
    lead.baths != null ? Number(lead.baths) : null,
  );
  pushField(
    customFields,
    process.env.GHL_CF_RENT_ID ?? "cSOIM9beSAgAC54uK5hD",
    lead.rent_price != null ? Number(lead.rent_price) : null,
  );
  pushField(
    customFields,
    process.env.GHL_CF_SOURCE_URL_ID ?? "KtWhCph0r6O24EvrdDhl",
    lead.url ?? null,
  );
  pushField(
    customFields,
    process.env.GHL_CF_SOURCE_ID_ID ?? "Qs5jkgMhfpsvzbXwOY2j",
    lead.zid ?? null,
  );

  return {
    locationId: process.env.GHL_LOCATION_ID,
    firstName: lead.first_name ?? "",
    lastName: lead.last_name ?? "",
    phone: lead.owner_number ?? "",
    email: lead.owner_email ?? "",
    address1: lead.address ?? "",
    city: lead.city ?? "",
    state: lead.state ?? "",
    postalCode: lead.zipcode ?? "",
    source: "Zillow ForRent",
    customFields,
  };
}

export async function sendLeadToGhl(
  lead: LeadForGhl,
  opts?: { listName?: string },
): Promise<GhlSendResult> {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!apiKey || !locationId) {
    return {
      ok: false,
      error_message: "GHL_API_KEY or GHL_LOCATION_ID missing",
    };
  }

  const url = `${GHL_BASE}/contacts/`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const body = buildGhlPayload(lead, opts);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Version: GHL_VERSION,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const ok = res.ok;
    return {
      ok,
      http_status: res.status,
      error_message: ok ? undefined : await res.text().catch(() => undefined),
    };
  } catch (e) {
    clearTimeout(t);
    return {
      ok: false,
      error_message: e instanceof Error ? e.message : String(e),
    };
  }
}
