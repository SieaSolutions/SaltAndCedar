import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { sql } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const todayRows = await sql`
    SELECT COUNT(*)::int AS c FROM leads
    WHERE ((date_scraped AT TIME ZONE 'America/New_York')::date)
        = ((NOW() AT TIME ZONE 'America/New_York')::date)
  `;
  const todayFound = Number((todayRows[0] as { c: number }).c ?? 0);

  const newRows = await sql`
    SELECT COUNT(*)::int AS c FROM leads WHERE status = 'New'
  `;
  const newCount = Number((newRows[0] as { c: number }).c ?? 0);

  const settingsRows = await sql`
    SELECT cities, daily_target FROM settings WHERE id = 1 LIMIT 1
  `;
  const settings = settingsRows[0] as
    | {
        cities: string[];
        daily_target: number;
      }
    | undefined;

  const todayLeadgenRows = await sql`
    SELECT id, leads_found, target, cities_processed, status, started_at::text, completed_at::text
    FROM runs
    WHERE type = 'leadgen'
      AND ((started_at AT TIME ZONE 'America/New_York')::date)
          = ((NOW() AT TIME ZONE 'America/New_York')::date)
    ORDER BY started_at DESC
    LIMIT 1
  `;

  const todayLeadgen = todayLeadgenRows[0] as
    | {
        id: number;
        leads_found: number | null;
        target: number | null;
        cities_processed: string[];
        status: string;
        started_at: string;
        completed_at: string | null;
      }
    | undefined;

  const lastGhlRows = await sql`
    SELECT id, leads_sent, status, started_at::text, completed_at::text, target
    FROM runs WHERE type = 'ghl'
    ORDER BY started_at DESC LIMIT 1
  `;
  const lastGhl = lastGhlRows[0] as
    | {
        id: number;
        leads_sent: number | null;
        status: string;
        started_at: string;
        completed_at: string | null;
        target: number | null;
      }
    | undefined;

  const recent = await sql`
    SELECT id, owner_name, owner_number, city, state, status, date_scraped::text
    FROM leads
    ORDER BY created_at DESC
    LIMIT 10
  `;

  const cityTotal = settings?.cities?.length ?? 0;
  const processedCount = todayLeadgen?.cities_processed?.length ?? 0;
  const lf = Number(todayLeadgen?.leads_found ?? 0);
  const tgt = Number(todayLeadgen?.target ?? settings?.daily_target ?? 200);

  const progressHint = todayLeadgen
    ? `${processedCount} of ${cityTotal} cities touched · ${lf} of ${tgt} leads toward daily target · run ${todayLeadgen.status}`
    : "";

  const ghlHint = lastGhl
    ? `${lastGhl.started_at} · sent ${lastGhl.leads_sent ?? 0} · ${lastGhl.status}`
    : "—";

  return (
    <div className="space-y-8">
      {!settings ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No settings row found — run{" "}
          <code className="rounded bg-white px-1 py-0.5 text-xs">
            psql &quot;$DATABASE_URL&quot; -f scripts/init-db.sql
          </code>{" "}
          on Neon.
        </div>
      ) : null}
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Dashboard</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Leads found today" value={todayFound} />
        <StatCard title="New (waiting for GHL)" value={newCount} />
        <StatCard
          title="Today’s leadgen run"
          value={
            todayLeadgen ? (
              <span className="text-xl">{lf}</span>
            ) : (
              <span className="text-xl text-stone-400">—</span>
            )
          }
          hint={progressHint}
        />
        <StatCard
          title="Last GHL batch"
          value={
            lastGhl ? (
              <span className="text-xl">{lastGhl.leads_sent ?? 0}</span>
            ) : (
              <span className="text-xl text-stone-400">—</span>
            )
          }
          hint={ghlHint}
        />
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-stone-700">
          Manual run controls are now in{" "}
          <Link
            href="/runs"
            className="font-medium text-[var(--accent)] hover:underline"
          >
            Run history
          </Link>
          .
        </p>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-stone-900">
            Recent leads
          </h2>
          <Link
            href="/leads"
            className="text-sm font-medium text-[var(--accent)] hover:underline"
          >
            View all →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Scraped</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {(recent as Record<string, unknown>[]).map((r) => (
                <tr key={String(r.id)} className="hover:bg-stone-50/80">
                  <td className="px-4 py-3 font-medium text-stone-900">
                    {(r.owner_name as string) ?? "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-stone-700">
                    {(r.owner_number as string) ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    {(r.city as string) ?? "—"},{" "}
                    {(r.state as string) ?? ""}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={String(r.status)} />
                  </td>
                  <td className="px-4 py-3 text-xs text-stone-500">
                    {(r.date_scraped as string) ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(recent as unknown[]).length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-stone-500">
              No leads yet.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
