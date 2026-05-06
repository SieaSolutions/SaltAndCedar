export type LeadStatus =
  | "New"
  | "GHL"
  | "AlreadyInGHL"
  | "Failed"
  | "Lost"
  | "Won";

export interface SettingsRow {
  id: number;
  daily_target: number;
  cities: string[];
  min_rent: string | number;
  min_beds: number;
  is_furnished: boolean;
  days_back: number;
  max_results_per_city: number;
}

export interface RunRow {
  id: number;
  type: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  target: number | null;
  leads_found: number | null;
  leads_sent: number | null;
  cities_processed: string[];
}

export interface LeadRow {
  id: number;
  owner_name: string | null;
  first_name: string | null;
  last_name: string | null;
  owner_number: string | null;
  owner_email: string | null;
  status: LeadStatus;
  source: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zipcode: string | null;
  beds: string | number | null;
  baths: string | number | null;
  rent_price: string | number | null;
  lat: string | number | null;
  long: string | number | null;
  url: string | null;
  zid: string | null;
  date_scraped: string | null;
  ghl_sent_at: string | null;
  created_at: string | null;
}

export interface ListingMerged {
  zpid: string;
  addressLine: string;
  city: string;
  state: string;
  zipcode: string;
  lat: number | null;
  long: number | null;
  beds: number | null;
  baths: number | null;
  rent_price: number | null;
  url: string | null;
  listingDateRaw: string | null;
  displayName: string | null;
  businessName: string | null;
  phoneRaw: string | null;
  /** Email returned by Tracerfy enrichment (optional). */
  tracerfy_email?: string | null;
}
