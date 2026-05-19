import type { ListingMerged } from "@/lib/types";
import { normalizePhone } from "@/lib/phone";
import { isMobilePhoneType } from "@/lib/phoneType";

const BLOCKLIST = [
  "Properties",
  "Realty",
  "Rentals",
  "Homes",
  "LLC",
  "Real Estate",
  "Management",
  "Accommodations",
  "Investments",
  "Co.",
  "Group",
  "Housing",
  "Solutions",
  "Services",
  "Ventures",
  "Partners",
  "Path",
  "Living",
] as const;

function containsKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return BLOCKLIST.some((kw) => lower.includes(kw.toLowerCase()));
}

export interface Candidate extends ListingMerged {
  owner_name: string | null;
  owner_email: string | null;
  /** Set on CSV import when a phone-type column is mapped. */
  phoneTypeRaw?: string | null;
}

export function evaluateCandidate(
  c: Candidate,
  opts: {
    dbPhones: Set<string>;
    runPhones: Set<string>;
    /** CSV import: only keep rows whose phone type is mobile/cell. */
    requireMobile?: boolean;
  },
): { keep: boolean; reason?: string } {
  const phone = normalizePhone(c.phoneRaw);
  if (!phone || phone.length < 10) {
    return { keep: false, reason: "no_phone" };
  }

  if (opts.requireMobile && !isMobilePhoneType(c.phoneTypeRaw)) {
    return { keep: false, reason: "not_mobile" };
  }

  const ownerName = (c.owner_name ?? "").trim();
  if (
    !ownerName ||
    ownerName.toLowerCase() === "none" ||
    ownerName.length <= 1
  ) {
    return { keep: false, reason: "bad_owner_name" };
  }

  const biz = (c.businessName ?? "").trim();
  if (containsKeyword(ownerName) || (biz && containsKeyword(biz))) {
    return { keep: false, reason: "keyword_blocklist" };
  }

  if (opts.dbPhones.has(phone) || opts.runPhones.has(phone)) {
    return { keep: false, reason: "duplicate_phone" };
  }

  return { keep: true };
}

export function summarizeReasons(
  counts: Map<string, number>,
): { reason: string; count: number }[] {
  return [...counts.entries()].map(([reason, count]) => ({ reason, count }));
}
