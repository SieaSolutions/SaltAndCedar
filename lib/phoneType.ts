/**
 * Classify CSV / enrichment phone-line types. Import keeps mobile only.
 */

const MOBILE_PATTERNS = [
  /\bmobile\b/i,
  /\bcell\b/i,
  /\bcellular\b/i,
  /\bwireless\b/i,
  /\bprepaid\s*wireless\b/i,
  /^m$/i,
  /^mob$/i,
  /^cell$/i,
];

const NON_MOBILE_PATTERNS = [
  /\blandline\b/i,
  /\bland\s*line\b/i,
  /\bfixed\b/i,
  /\bvoip\b/i,
  /\bhome\b/i,
  /\bresidential\b/i,
  /\bwork\b/i,
  /\boffice\b/i,
  /\bbusiness\b/i,
  /\bdesk\b/i,
  /\bpager\b/i,
  /\bfax\b/i,
  /\btoll[\s-]?free\b/i,
  /\bother\b/i,
  /^l$/i,
  /^land$/i,
  /^fix$/i,
];

/** True when the value clearly indicates a mobile / cell line. */
export function isMobilePhoneType(raw: string | null | undefined): boolean {
  const t = (raw ?? "").trim();
  if (!t) return false;

  if (NON_MOBILE_PATTERNS.some((re) => re.test(t))) return false;
  if (MOBILE_PATTERNS.some((re) => re.test(t))) return true;

  // Unknown labels are not trusted for SMS deliverability.
  return false;
}
