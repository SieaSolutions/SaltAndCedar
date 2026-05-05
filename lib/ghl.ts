import type { LeadRow } from "@/lib/types";

export interface GhlSendResult {
  ok: boolean;
  http_status?: number;
  error_message?: string;
}

export function buildGhlPayload(lead: Pick<
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
>) {
  return {
    firstName: lead.first_name ?? "",
    lastName: lead.last_name ?? "",
    phone: lead.owner_number ?? "",
    email: lead.owner_email ?? "",
    address: lead.address ?? "",
    city: lead.city ?? "",
    state: lead.state ?? "",
    zipcode: lead.zipcode ?? "",
    source: "Zillow ForRent",
    customFields: {
      beds: lead.beds != null ? Number(lead.beds) : null,
      baths: lead.baths != null ? Number(lead.baths) : null,
      rentPrice:
        lead.rent_price != null ? Number(lead.rent_price) : null,
      zillowUrl: lead.url ?? "",
      zid: lead.zid ?? "",
    },
  };
}

export async function sendLeadToGhl(
  lead: Pick<
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
  >,
): Promise<GhlSendResult> {
  const url = process.env.GHL_WEBHOOK_URL;
  if (!url) {
    return { ok: false, error_message: "GHL_WEBHOOK_URL missing" };
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const body = buildGhlPayload(lead);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
