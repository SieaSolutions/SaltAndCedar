"use client";

import { Button } from "@/components/Button";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

export type SettingsDTO = {
  daily_target: number;
  cities: string[];
  min_rent: number;
  min_beds: number;
  is_furnished: boolean;
  days_back: number;
};

export function SettingsForm({ initial }: { initial: SettingsDTO }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>("");

  const [daily_target, setDaily_target] = useState(initial.daily_target);
  const [min_rent, setMin_rent] = useState(Number(initial.min_rent));
  const [min_beds, setMin_beds] = useState(initial.min_beds);
  const [is_furnished, setIs_furnished] = useState(initial.is_furnished);
  const [days_back, setDays_back] = useState(initial.days_back);

  const [cities, setCities] = useState<string[]>(initial.cities ?? []);
  const [cityInput, setCityInput] = useState("");

  const payload = useMemo(
    () => ({
      daily_target,
      cities,
      min_rent,
      min_beds,
      is_furnished,
      days_back,
    }),
    [daily_target, cities, min_rent, min_beds, is_furnished, days_back],
  );

  function moveCity(idx: number, dir: -1 | 1) {
    setCities((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      const t = next[idx]!;
      next[idx] = next[j]!;
      next[j] = t;
      return next;
    });
  }

  function addCity() {
    const v = cityInput.trim();
    if (!v) return;
    setCities((c) => [...c, v]);
    setCityInput("");
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-stone-700">
          Daily target (leadgen stop + GHL batch math)
          <input
            type="number"
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
            value={daily_target}
            min={1}
            onChange={(e) => setDaily_target(Number(e.target.value))}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-stone-700">
          Min rent
          <input
            type="number"
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
            value={min_rent}
            min={0}
            onChange={(e) => setMin_rent(Number(e.target.value))}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-stone-700">
          Min beds
          <input
            type="number"
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
            value={min_beds}
            min={0}
            onChange={(e) => setMin_beds(Number(e.target.value))}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-stone-700">
          Days back (Zillow window)
          <input
            type="number"
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
            value={days_back}
            min={1}
            onChange={(e) => setDays_back(Number(e.target.value))}
          />
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
          <input
            type="checkbox"
            checked={is_furnished}
            onChange={(e) => setIs_furnished(e.target.checked)}
          />
          Furnished filter (Apify)
        </label>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-medium text-stone-900">City list (order matters)</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            placeholder="Add city name"
            className="min-w-[200px] flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
          <Button type="button" variant="secondary" onClick={addCity}>
            Add
          </Button>
        </div>
        <ul className="mt-4 divide-y divide-stone-100 rounded-lg border border-stone-100">
          {cities.map((c, idx) => (
            <li
              key={`${c}-${idx}`}
              className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
            >
              <span className="font-medium text-stone-900">{c}</span>
              <span className="flex gap-1">
                <button
                  type="button"
                  className="rounded border border-stone-200 px-2 py-1 text-xs hover:bg-stone-50"
                  onClick={() => moveCity(idx, -1)}
                  aria-label="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="rounded border border-stone-200 px-2 py-1 text-xs hover:bg-stone-50"
                  onClick={() => moveCity(idx, 1)}
                  aria-label="Move down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="rounded border border-stone-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                  onClick={() =>
                    setCities((prev) => prev.filter((_, i) => i !== idx))
                  }
                >
                  Remove
                </button>
              </span>
            </li>
          ))}
          {cities.length === 0 ? (
            <li className="px-3 py-4 text-sm text-stone-500">
              No cities yet — leadgen ticks will skip until you add some.
            </li>
          ) : null}
        </ul>
      </div>

      <Button
        variant="primary"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            setMessage("");
            const res = await fetch("/api/settings", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) {
              setMessage(body.error ?? "Save failed");
              return;
            }
            setMessage("Saved.");
            router.refresh();
          });
        }}
      >
        Save settings
      </Button>

      {message ? (
        <p className="text-sm text-stone-600">{message}</p>
      ) : null}
    </div>
  );
}
