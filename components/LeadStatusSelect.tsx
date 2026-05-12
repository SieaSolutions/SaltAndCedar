"use client";

import type { LeadStatus } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

const STATUSES: LeadStatus[] = [
  "New",
  "GHL",
  "AlreadyInGHL",
  "Failed",
  "Lost",
  "Won",
];

const selectStyles: Record<LeadStatus, string> = {
  New: "border-stone-200 bg-stone-50 text-stone-700",
  GHL: "border-sky-200 bg-sky-50 text-sky-800",
  AlreadyInGHL: "border-violet-200 bg-violet-50 text-violet-800",
  Failed: "border-red-200 bg-red-50 text-red-800",
  Lost: "border-amber-200 bg-amber-50 text-amber-900",
  Won: "border-emerald-200 bg-emerald-50 text-emerald-900",
};

export function LeadStatusSelect({
  leadId,
  status: initialStatus,
}: {
  leadId: number;
  status: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  const style =
    selectStyles[status as LeadStatus] ?? "border-stone-200 bg-white text-stone-700";

  return (
    <div className="flex flex-col gap-1">
      <select
        value={status}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          const prev = status;
          setStatus(next);
          startTransition(async () => {
            setError(null);
            const res = await fetch(`/api/leads/${leadId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: next }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) {
              setStatus(prev);
              setError(body.error ?? "Update failed");
              return;
            }
            router.refresh();
          });
        }}
        className={`min-w-[8.5rem] rounded-lg border px-2 py-1 text-xs font-medium disabled:opacity-60 ${style}`}
        aria-label="Lead status"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      {error ? <span className="text-[10px] text-red-600">{error}</span> : null}
    </div>
  );
}
