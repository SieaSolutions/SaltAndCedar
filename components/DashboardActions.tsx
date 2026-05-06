"use client";

import {
  actionGhlNow,
  actionLeadgenAll,
  actionLeadgenNext,
} from "@/app/actions/dashboard";
import { useState, useTransition } from "react";
import { Button } from "@/components/Button";

export function DashboardActions() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>("");

  function run(label: string, fn: () => Promise<string>) {
    startTransition(async () => {
      setMessage(`${label}…`);
      try {
        const raw = await fn();
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        setMessage(JSON.stringify(parsed, null, 2));
      } catch (e) {
        setMessage(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-stone-800">Manual runs</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() =>
            run("Process next city", () => actionLeadgenNext())
          }
        >
          Process next city
        </Button>
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() =>
            run("Process all remaining", () => actionLeadgenAll())
          }
        >
          Process all remaining
        </Button>
        <Button
          variant="primary"
          disabled={pending}
          onClick={() => run("Run GHL batch", () => actionGhlNow())}
        >
          Run GHL now
        </Button>
      </div>
      {message ? (
        <pre className="mt-4 max-h-48 overflow-auto rounded-lg bg-stone-900 p-3 text-xs text-stone-100">
          {message}
        </pre>
      ) : null}
    </div>
  );
}
