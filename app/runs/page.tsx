import { DashboardActions } from "@/components/DashboardActions";
import { StatusBadge } from "@/components/StatusBadge";
import { sql } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function RunsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const typeRaw = sp.type;
  const type =
    typeof typeRaw === "string"
      ? typeRaw
      : Array.isArray(typeRaw)
        ? typeRaw[0]
        : "";

  const rows =
    type === "leadgen" || type === "ghl"
      ? await sql`
          SELECT id, type, started_at::text, completed_at::text, status,
                 target, leads_found, leads_sent, cities_processed
          FROM runs
          WHERE type = ${type}
          ORDER BY started_at DESC
          LIMIT 200
        `
      : await sql`
          SELECT id, type, started_at::text, completed_at::text, status,
                 target, leads_found, leads_sent, cities_processed
          FROM runs
          ORDER BY started_at DESC
          LIMIT 200
        `;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Run history</h1>
        <p className="mt-1 text-sm text-stone-600">
          Leadgen ticks (one row per calendar day) and GHL batches.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterTab href="/runs" label="All" active={!type} />
        <FilterTab
          href="/runs?type=leadgen"
          label="Leadgen"
          active={type === "leadgen"}
        />
        <FilterTab
          href="/runs?type=ghl"
          label="GHL"
          active={type === "ghl"}
        />
      </div>

      <DashboardActions />

      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-stone-50 text-xs uppercase text-stone-500">
            <tr>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Started</th>
              <th className="px-4 py-3 font-medium">Completed</th>
              <th className="px-4 py-3 font-medium">Duration</th>
              <th className="px-4 py-3 font-medium">Target</th>
              <th className="px-4 py-3 font-medium">Found / Sent</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Cities</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {(rows as Record<string, unknown>[]).map((r) => {
              const start = r.started_at
                ? new Date(String(r.started_at))
                : null;
              const end = r.completed_at
                ? new Date(String(r.completed_at))
                : null;
              const durationMs =
                start && end ? end.getTime() - start.getTime() : null;
              const cities = (r.cities_processed as string[]) ?? [];

              return (
                <tr key={String(r.id)} className="hover:bg-stone-50/80">
                  <td className="px-4 py-3 font-medium text-stone-900">
                    {String(r.type)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-stone-700">
                    {String(r.started_at ?? "—")}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-stone-700">
                    {String(r.completed_at ?? "—")}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-stone-600">
                    {durationMs != null
                      ? `${Math.round(durationMs / 1000)}s`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-stone-600">
                    {r.target != null ? String(r.target) : "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-stone-800">
                    {r.type === "leadgen"
                      ? String(r.leads_found ?? "—")
                      : String(r.leads_sent ?? "—")}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={String(r.status)} />
                  </td>
                  <td className="max-w-[280px] truncate px-4 py-3 text-xs text-stone-600">
                    {cities.length ? cities.join(", ") : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {(rows as unknown[]).length === 0 ? (
          <p className="py-10 text-center text-sm text-stone-500">No runs.</p>
        ) : null}
      </div>
    </div>
  );
}

function FilterTab({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-4 py-1.5 text-sm font-medium ${
        active
          ? "bg-[var(--accent)] text-white"
          : "border border-stone-300 bg-white text-stone-800 hover:bg-stone-50"
      }`}
    >
      {label}
    </Link>
  );
}
