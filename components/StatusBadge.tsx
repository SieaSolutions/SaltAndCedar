import type { LeadStatus } from "@/lib/types";

const leadStyles: Record<LeadStatus, string> = {
  New: "bg-stone-100 text-stone-700 ring-stone-200",
  GHL: "bg-sky-100 text-sky-800 ring-sky-200",
  AlreadyInGHL: "bg-violet-100 text-violet-800 ring-violet-200",
  Failed: "bg-red-100 text-red-800 ring-red-200",
  Lost: "bg-amber-100 text-amber-900 ring-amber-200",
  Won: "bg-emerald-100 text-emerald-900 ring-emerald-200",
};

const runStyles: Record<string, string> = {
  running: "bg-indigo-100 text-indigo-900 ring-indigo-200",
  completed: "bg-emerald-100 text-emerald-900 ring-emerald-200",
  failed: "bg-red-100 text-red-900 ring-red-200",
};

export function StatusBadge({ status }: { status: string }) {
  const cls =
    leadStyles[status as LeadStatus] ??
    runStyles[status] ??
    "bg-stone-100 text-stone-600 ring-stone-200";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}
    >
      {status}
    </span>
  );
}
