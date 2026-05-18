import { LeadStatusSelect } from "@/components/LeadStatusSelect";
import { PhoneCell } from "@/components/PhoneCell";
import { RetryLeadButton } from "@/components/RetryLeadButton";
import { LEAD_STATUSES } from "@/lib/types";
import { parseLeadFilters } from "@/lib/leadFilters";
import { countLeads, listLeads } from "@/lib/leadQueries";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STATUSES = ["", ...LEAD_STATUSES];

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const spRaw = await searchParams;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(spRaw)) {
    if (typeof v === "string") sp.set(k, v);
    else if (Array.isArray(v) && v[0]) sp.set(k, v[0]);
  }

  const f = parseLeadFilters(sp);
  const page = Math.max(1, Number(sp.get("page") ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(5, Number(sp.get("pageSize") ?? "20") || 20));
  const offset = (page - 1) * pageSize;

  const [total, rows] = await Promise.all([
    countLeads(f),
    listLeads(f, pageSize, offset),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function hrefWith(qs: Record<string, string>) {
    const n = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(qs)) {
      if (!v) n.delete(k);
      else n.set(k, v);
    }
    return `/leads?${n.toString()}`;
  }

  const exportHref = `/api/leads/export?${sp.toString()}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Leads</h1>
          <p className="mt-1 text-sm text-stone-600">{total} matching rows</p>
        </div>
        <a
          href={exportHref}
          className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 hover:bg-stone-50"
        >
          Export CSV
        </a>
      </div>

      <form
        className="grid gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm md:grid-cols-3 lg:grid-cols-6"
        action="/leads"
        method="get"
      >
        <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
          Status
          <select
            name="status"
            defaultValue={sp.get("status") ?? ""}
            className="rounded-lg border border-stone-300 px-2 py-2 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s || "all"} value={s}>
                {s || "All"}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
          City contains
          <input
            name="city"
            defaultValue={sp.get("city") ?? ""}
            className="rounded-lg border border-stone-300 px-2 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
          State contains
          <input
            name="state"
            defaultValue={sp.get("state") ?? ""}
            className="rounded-lg border border-stone-300 px-2 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
          From (NY date)
          <input
            type="date"
            name="dateFrom"
            defaultValue={sp.get("dateFrom") ?? ""}
            className="rounded-lg border border-stone-300 px-2 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
          To (NY date)
          <input
            type="date"
            name="dateTo"
            defaultValue={sp.get("dateTo") ?? ""}
            className="rounded-lg border border-stone-300 px-2 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
          Search name / phone
          <input
            name="search"
            defaultValue={sp.get("search") ?? ""}
            className="rounded-lg border border-stone-300 px-2 py-2 text-sm"
          />
        </label>
        <div className="flex items-end gap-2 md:col-span-3 lg:col-span-6">
          <button
            type="submit"
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Apply filters
          </button>
          <Link
            href="/leads"
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Reset
          </Link>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-stone-50 text-xs uppercase text-stone-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Address</th>
              <th className="px-4 py-3 font-medium">City</th>
              <th className="px-4 py-3 font-medium">St</th>
              <th className="px-4 py-3 font-medium">Beds</th>
              <th className="px-4 py-3 font-medium">Baths</th>
              <th className="px-4 py-3 font-medium">Rent</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {(rows as Record<string, unknown>[]).map((r) => (
              <tr key={String(r.id)} className="hover:bg-stone-50/80">
                <td className="px-4 py-3 font-medium text-stone-900">
                  {(r.owner_name as string) ?? "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <PhoneCell value={r.owner_number as string | null} />
                </td>
                <td className="px-4 py-3 text-stone-600">
                  {(r.owner_email as string) ?? "—"}
                </td>
                <td className="max-w-[220px] truncate px-4 py-3 text-stone-600">
                  {(r.address as string) ?? "—"}
                </td>
                <td className="px-4 py-3 text-stone-600">
                  {(r.city as string) ?? "—"}
                </td>
                <td className="px-4 py-3 text-stone-600">
                  {(r.state as string) ?? "—"}
                </td>
                <td className="px-4 py-3 tabular-nums text-stone-600">
                  {r.beds != null ? String(r.beds) : "—"}
                </td>
                <td className="px-4 py-3 tabular-nums text-stone-600">
                  {r.baths != null ? String(r.baths) : "—"}
                </td>
                <td className="px-4 py-3 tabular-nums text-stone-600">
                  {r.rent_price != null ? String(r.rent_price) : "—"}
                </td>
                <td className="px-4 py-3">
                  <LeadStatusSelect
                    leadId={Number(r.id)}
                    status={String(r.status)}
                  />
                </td>
                <td className="px-4 py-3">
                  {String(r.status) === "Failed" ? (
                    <RetryLeadButton leadId={Number(r.id)} />
                  ) : (
                    <span className="text-xs text-stone-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(rows as unknown[]).length === 0 ? (
          <p className="py-10 text-center text-sm text-stone-500">
            No rows.
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-stone-600">
          Page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <Link
            className={`rounded-lg border border-stone-300 px-3 py-1.5 hover:bg-stone-50 ${
              page <= 1 ? "pointer-events-none opacity-40" : ""
            }`}
            href={hrefWith({ page: String(Math.max(1, page - 1)) })}
            aria-disabled={page <= 1}
          >
            Previous
          </Link>
          <Link
            className={`rounded-lg border border-stone-300 px-3 py-1.5 hover:bg-stone-50 ${
              page >= totalPages ? "pointer-events-none opacity-40" : ""
            }`}
            href={hrefWith({ page: String(Math.min(totalPages, page + 1)) })}
            aria-disabled={page >= totalPages}
          >
            Next
          </Link>
        </div>
      </div>
    </div>
  );
}
