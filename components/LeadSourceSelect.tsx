"use client";

import { LEAD_SOURCES, type LeadSource } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

const selectStyles: Record<LeadSource, string> = {
  SieaSolutions: "border-violet-200 bg-violet-50 text-violet-800",
  Evolve: "border-sky-200 bg-sky-50 text-sky-800",
  Zillow: "border-blue-200 bg-blue-50 text-blue-800",
};

export function LeadSourceSelect({
  leadId,
  source: initialSource,
}: {
  leadId: number;
  source: string;
}) {
  const router = useRouter();
  const [source, setSource] = useState(initialSource);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setSource(initialSource);
  }, [initialSource]);

  const style =
    selectStyles[source as LeadSource] ?? "border-stone-200 bg-white text-stone-700";

  return (
    <div className="flex flex-col gap-1">
      <select
        value={source}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          const prev = source;
          setSource(next);
          startTransition(async () => {
            setError(null);
            const res = await fetch(`/api/leads/${leadId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ source: next }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) {
              setSource(prev);
              setError(body.error ?? "Update failed");
              return;
            }
            router.refresh();
          });
        }}
        className={`min-w-[8rem] rounded-lg border px-2 py-1 text-xs font-medium disabled:opacity-60 ${style}`}
        aria-label="Lead source"
      >
        {LEAD_SOURCES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
        {!LEAD_SOURCES.includes(source as LeadSource) && (
          <option value={source}>{source}</option>
        )}
      </select>
      {error ? <span className="text-[10px] text-red-600">{error}</span> : null}
    </div>
  );
}
