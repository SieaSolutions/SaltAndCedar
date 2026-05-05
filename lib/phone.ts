/** Normalize to digits only; strip leading US country code if present. Returns empty string if invalid for dedupe. */
export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  let d = raw.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return d.length >= 10 ? d.slice(-10) : d.length > 0 ? d : "";
}

export function phoneLast4(normalizedDigits: string): string {
  const d = normalizedDigits.replace(/\D/g, "");
  return d.slice(-4);
}
