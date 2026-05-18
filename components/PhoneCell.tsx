import { formatPhoneDisplay } from "@/lib/phone";

export function PhoneCell({ value }: { value: string | null | undefined }) {
  const formatted = formatPhoneDisplay(value);
  const raw = value?.trim();
  if (!formatted && !raw) {
    return <span className="text-stone-400">—</span>;
  }
  return (
    <span className="tabular-nums text-stone-700" title={raw ?? undefined}>
      {formatted || raw}
    </span>
  );
}
