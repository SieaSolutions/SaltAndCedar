/** Normalize to digits only; strip leading US country code if present. Returns empty string if invalid for dedupe. */
export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  let d = raw.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return d.length >= 10 ? d.slice(-10) : d.length > 0 ? d : "";
}

/** US display: (512) 555-0100 */
export function formatPhoneDisplay(raw: string | null | undefined): string {
  const d = normalizePhone(raw);
  if (d.length !== 10) return d || "";
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/** E.164 for GHL API: +15125550100 */
export function formatPhoneE164(raw: string | null | undefined): string {
  const d = normalizePhone(raw);
  if (d.length !== 10) return d ? `+${d}` : "";
  return `+1${d}`;
}

export function phoneLast4(normalizedDigits: string): string {
  const d = normalizedDigits.replace(/\D/g, "");
  return d.slice(-4);
}
