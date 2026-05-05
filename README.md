# Salt & Cedar Leads

Full-stack Next.js (App Router) app that replaces an n8n + Airtable automation and runs the rental lead pipeline:

**Apify (Zillow scrape + phones) → Tracerfy fallback → Postgres (Neon) → GoHighLevel outbound webhook**, plus inbound status updates.

## Prerequisites

- Node 20+
- A [Neon](https://neon.tech/) Postgres database
- Apify API token (two actors configured in code)
- Tracerfy API key
- GoHighLevel outbound webhook URL + inbound webhook secret you define

## Setup

```bash
npm install
cp .env.example .env.local
```

Fill `.env.local`:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon connection string |
| `APIFY_API_TOKEN` | Apify token |
| `TRACERFY_API_KEY` | Bearer token for Tracerfy `/lookup/` |
| `GHL_WEBHOOK_URL` | Outbound POST URL from GHL |
| `CRON_SECRET` | Shared secret — `Authorization: Bearer <CRON_SECRET>` on cron routes |
| `GHL_WEBHOOK_SECRET` | Sent as header `x-webhook-secret` on **inbound** `/api/webhooks/ghl` |

Initialize schema:

```bash
psql "$DATABASE_URL" -f scripts/init-db.sql
```

Run locally:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Deploy on Vercel (Pro recommended)

1. Connect the repo and set the same environment variables in the Vercel project.
2. **Password Protection** (Vercel Pro): Project → Settings → Deployment Protection → enable password for previews/production as you prefer.
3. **Cron**: `vercel.json` schedules:
   - Leadgen: every 5 minutes `12:00–13:55 UTC` (7:00–8:55 AM America/New_York) — **one city per invocation**.
   - GHL: `15–18 UTC` four times daily (10 AM–1 PM ET window).
4. Set `CRON_SECRET` in Vercel — Cron invokes `/api/cron/*` with `Authorization: Bearer …` automatically.

### Inbound GHL webhook through Password Protection

External POSTs cannot answer the password gate. Generate **Protection Bypass for Automation** in Vercel and append it to your GHL webhook URL (per Vercel docs). Always send header:

`x-webhook-secret: <GHL_WEBHOOK_SECRET>`

Adjust payload parsing in `app/api/webhooks/ghl/route.ts` once you see real GHL JSON.

### Tracerfy response shape

`lib/tracerfy.ts` includes a defensive JSON extractor (`phone`, `phones[]`, `phone_numbers[]`, `email`, `emails[]`). Tune `extractContact()` after your first successful trace.

## Manual runs (dashboard)

Server actions call the same logic as cron (`runLeadgenTick`, `runLeadgenUntilDone`, `runGhlBatch`). Ensure env vars exist locally.

## Project structure

- `app/api/cron/leadgen` — daily incremental leadgen worker  
- `app/api/cron/ghl` — batches `New` leads to GHL  
- `app/api/webhooks/ghl` — Won/Lost updates by phone  
- `lib/leadgenPipeline.ts` — per-city pipeline  
- `lib/cronLeadgen.ts` / `lib/cronGhl.ts` — orchestration + logging  

Structured logs are single-line JSON (`event`, `tick_id`, `run_id`, `city`, …) for Vercel Logs.

## License

Private — Salt & Cedar internal use.
