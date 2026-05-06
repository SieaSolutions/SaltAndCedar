import { SettingsForm, type SettingsDTO } from "@/components/SettingsForm";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const rows = await sql`
    SELECT daily_target, cities, min_rent, min_beds, is_furnished, days_back, max_results_per_city
    FROM settings WHERE id = 1 LIMIT 1
  `;

  if (!rows.length) {
    return (
      <p className="text-sm text-red-600">
        Settings row missing — run scripts/init-db.sql on Neon.
      </p>
    );
  }

  const r = rows[0] as Record<string, unknown>;
  const initial: SettingsDTO = {
    daily_target: Number(r.daily_target ?? 200),
    cities: (r.cities as string[]) ?? [],
    min_rent: Number(r.min_rent ?? 900),
    min_beds: Number(r.min_beds ?? 3),
    is_furnished: Boolean(r.is_furnished),
    days_back: Number(r.days_back ?? 1),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Settings</h1>
        <p className="mt-1 text-sm text-stone-600">
          Cities are processed top-to-bottom until the daily target is reached.
        </p>
      </div>

      <SettingsForm initial={initial} />
    </div>
  );
}
