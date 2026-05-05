import { sql } from "@/lib/db";
import { log } from "@/lib/log";
import { normalizePhone, phoneLast4 } from "@/lib/phone";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function extractStatus(payload: Record<string, unknown>): string | null {
  const candidates = [
    payload.status,
    payload.stage,
    payload.pipeline_stage,
    payload.tag,
    payload.pipelineStage,
    payload.dealStage,
  ];
  for (const c of candidates) {
    if (typeof c === "string") return c;
  }
  const nested = payload.contact as Record<string, unknown> | undefined;
  if (nested && typeof nested === "object") {
    const n = extractStatus(nested);
    if (n) return n;
  }
  return null;
}

function extractPhone(payload: Record<string, unknown>): string | null {
  const keys = ["phone", "Phone", "contact_phone", "contactPhone"] as const;
  for (const k of keys) {
    const v = payload[k];
    if (typeof v === "string") return v;
  }
  const nested = payload.contact as Record<string, unknown> | undefined;
  if (nested && typeof nested === "object") {
    const p = nested.phone ?? nested.phoneNumber;
    if (typeof p === "string") return p;
  }
  return null;
}

function mapStatus(raw: string): "Won" | "Lost" | null {
  const s = raw.trim().toLowerCase();
  if (s.includes("won")) return "Won";
  if (s.includes("lost")) return "Lost";
  if (raw === "Won") return "Won";
  if (raw === "Lost") return "Lost";
  return null;
}

export async function POST(request: Request) {
  const secret = process.env.GHL_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const hdr = request.headers.get("x-webhook-secret");
  if (hdr !== secret) {
    log.warn("webhook.unauthorized", {
      ip: request.headers.get("x-forwarded-for") ?? "",
      ua: request.headers.get("user-agent") ?? "",
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  log.info("webhook.received", {});

  let bodyText = "";
  try {
    bodyText = await request.text();
    const payload = JSON.parse(bodyText) as Record<string, unknown>;

    const phoneRaw = extractPhone(payload);
    const statusRaw = extractStatus(payload);

    if (!phoneRaw || !statusRaw) {
      log.warn("webhook.unknown_status", {
        payload_preview: JSON.stringify(payload).slice(0, 800),
      });
      return NextResponse.json({ error: "Missing phone or status" }, { status: 400 });
    }

    const mapped = mapStatus(statusRaw);
    if (!mapped) {
      log.warn("webhook.unknown_status", {
        status_raw: statusRaw,
        payload_preview: JSON.stringify(payload).slice(0, 800),
      });
      return NextResponse.json({ error: "Unknown status mapping" }, { status: 400 });
    }

    const normalized = normalizePhone(phoneRaw);
    if (!normalized || normalized.length < 10) {
      return NextResponse.json({ error: "Invalid phone" }, { status: 400 });
    }

    const rows = await sql`
      UPDATE leads SET status = ${mapped}
      WHERE owner_number = ${normalized}
      RETURNING id
    `;

    if (!rows.length) {
      log.warn("webhook.no_match", {
        phone_last4: phoneLast4(normalized),
      });
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    log.info("webhook.applied", {
      lead_id: (rows[0] as { id: number }).id,
      status: mapped,
      phone_last4: phoneLast4(normalized),
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    log.warn("webhook.bad_json", {
      body_preview: bodyText.slice(0, 500),
      error_message: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
