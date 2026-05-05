"use client";

import { Button } from "@/components/Button";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function RetryLeadButton({ leadId }: { leadId: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="secondary"
        className="py-1 text-xs"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            setMsg(null);
            const res = await fetch(`/api/leads/${leadId}/retry`, {
              method: "POST",
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) {
              setMsg(body.detail ?? body.error ?? "Retry failed");
              return;
            }
            setMsg("Sent");
            router.refresh();
          });
        }}
      >
        Retry GHL
      </Button>
      {msg ? <span className="text-[10px] text-stone-500">{msg}</span> : null}
    </div>
  );
}
