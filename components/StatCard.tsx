import type { ReactNode } from "react";

export function StatCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
        {title}
      </p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-stone-900">
        {value}
      </p>
      {hint ? (
        <p className="mt-2 text-xs text-stone-500">{hint}</p>
      ) : null}
    </div>
  );
}
