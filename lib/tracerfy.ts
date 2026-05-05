import { log } from "@/lib/log";
import { splitOwnerName } from "@/lib/nameParser";
import type { ListingMerged } from "@/lib/types";

const URL = "https://tracerfy.com/v1/api/trace/lookup/";

/** TODO: adjust field extraction after observing real Tracerfy responses */
export function extractContact(json: unknown): {
  phone: string | null;
  email: string | null;
} {
  if (!json || typeof json !== "object") return { phone: null, email: null };
  const o = json as Record<string, unknown>;

  let phone: string | null = null;
  if (typeof o.phone === "string") phone = o.phone;
  else if (Array.isArray(o.phones) && o.phones.length && typeof o.phones[0] === "string")
    phone = o.phones[0];
  else if (
    Array.isArray(o.phone_numbers) &&
    o.phone_numbers.length &&
    typeof o.phone_numbers[0] === "string"
  )
    phone = o.phone_numbers[0];

  let email: string | null = null;
  if (typeof o.email === "string") email = o.email;
  else if (Array.isArray(o.emails) && o.emails.length && typeof o.emails[0] === "string")
    email = o.emails[0];

  return { phone, email };
}

async function lookupOnce(
  body: Record<string, unknown>,
  signal: AbortSignal,
): Promise<Response> {
  const key = process.env.TRACERFY_API_KEY;
  if (!key) throw new Error("TRACERFY_API_KEY missing");
  return fetch(URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });
}

async function lookupWithRetry(
  body: Record<string, unknown>,
  ctx: { zpid?: string; tick_id?: string; run_id?: number; city?: string },
): Promise<{ phone: string | null; email: string | null }> {
  let attempt = 0;
  while (attempt < 2) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15_000);
    try {
      const res = await lookupOnce(body, ctrl.signal);
      clearTimeout(t);
      if ((res.status >= 500 || res.status === 429) && attempt === 0) {
        attempt++;
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        log.warn("tracerfy.lookup.failed", {
          ...ctx,
          http_status: res.status,
          body_preview: txt.slice(0, 200),
        });
        return { phone: null, email: null };
      }
      const json = await res.json().catch(() => null);
      return extractContact(json);
    } catch (e) {
      clearTimeout(t);
      if (attempt === 0) {
        attempt++;
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      log.warn("tracerfy.lookup.failed", {
        ...ctx,
        error_name: e instanceof Error ? e.name : typeof e,
      });
      return { phone: null, email: null };
    }
  }
  return { phone: null, email: null };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Mutates listings in place: fills phoneRaw / owner_email when empty */
export async function enrichMissingPhonesTracerfy(
  rows: ListingMerged[],
  opts: { tick_id?: string; run_id?: number; city?: string },
): Promise<void> {
  const targets = rows.filter((r) => !r.phoneRaw || r.phoneRaw.trim() === "");
  if (!targets.length) return;

  log.info("tracerfy.batch.started", {
    ...opts,
    requested: targets.length,
  });

  let lookups_finished = 0;
  let returnedPhone = 0;
  let returnedEmail = 0;
  const errors: string[] = [];

  for (const batch of chunk(targets, 5)) {
    await Promise.allSettled(
      batch.map(async (row) => {
        const ownerDisplay = row.displayName?.trim();
        const bodyBase = {
          address: row.addressLine,
          city: row.city,
          state: row.state,
          zip: row.zipcode,
        };

        let body: Record<string, unknown>;
        if (ownerDisplay) {
          const { first_name, last_name } = splitOwnerName(ownerDisplay);
          body = {
            ...bodyBase,
            find_owner: false,
            first_name: first_name ?? "",
            last_name: last_name ?? "",
          };
        } else {
          body = { ...bodyBase, find_owner: true };
        }

        try {
          const { phone, email } = await lookupWithRetry(body, {
            zpid: row.zpid,
            ...opts,
          });
          lookups_finished++;
          if (phone) {
            returnedPhone++;
            row.phoneRaw = phone;
          }
          if (email) {
            returnedEmail++;
            row.tracerfy_email = email;
          }
        } catch (e) {
          errors.push(String(e));
          log.warn("tracerfy.lookup.failed", {
            ...opts,
            zpid: row.zpid,
            error_message: String(e),
          });
        }
      }),
    );
  }

  log.info("tracerfy.batch.completed", {
    ...opts,
    requested: targets.length,
    lookups_finished,
    returned_phone: returnedPhone,
    returned_email: returnedEmail,
    error_samples: errors.slice(0, 5),
  });
}
