import { LEAD_STATUSES } from "@/lib/types";

export type LeadListFilters = {
  status: string | null;
  cityLike: string | null;
  stateLike: string | null;
  fromDate: string | null;
  toDate: string | null;
  searchText: string | null;
  searchDigits: string | null;
};

export function parseLeadFilters(sp: URLSearchParams): LeadListFilters {
  const status = sp.get("status")?.trim() || null;
  const city = sp.get("city")?.trim();
  const state = sp.get("state")?.trim();
  const dateFrom = sp.get("dateFrom")?.trim() || null;
  const dateTo = sp.get("dateTo")?.trim() || null;
  const searchRaw = sp.get("search")?.trim() || null;

  const searchDigits =
    searchRaw && searchRaw.replace(/\D/g, "").length >= 3
      ? searchRaw.replace(/\D/g, "")
      : null;

  return {
    status:
      status && LEAD_STATUSES.includes(status as (typeof LEAD_STATUSES)[number])
        ? status
        : null,
    cityLike: city ? `%${city}%` : null,
    stateLike: state ? `%${state}%` : null,
    fromDate: dateFrom,
    toDate: dateTo,
    searchText: searchRaw,
    searchDigits,
  };
}
