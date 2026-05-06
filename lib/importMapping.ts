/**
 * Pure header-mapping vocabulary shared by the client UI and the server
 * import pipeline. No runtime deps so it's safe to import from a client
 * component.
 */

export const MAPPABLE_FIELDS = [
  "owner_name",
  "first_name",
  "last_name",
  "owner_number",
  "owner_email",
  "address",
  "city",
  "state",
  "zipcode",
  "beds",
  "baths",
  "rent_price",
  "url",
  "zid",
] as const;

export type MappableField = (typeof MAPPABLE_FIELDS)[number];
export type Mapping = "ignore" | MappableField;

export const FIELD_LABELS: Record<MappableField, string> = {
  owner_name: "Owner name",
  first_name: "First name",
  last_name: "Last name",
  owner_number: "Phone (owner_number)",
  owner_email: "Email",
  address: "Address",
  city: "City",
  state: "State",
  zipcode: "Zipcode",
  beds: "Beds",
  baths: "Baths",
  rent_price: "Rent price",
  url: "URL",
  zid: "Zillow ID",
};

/**
 * Synonym table for auto-suggesting mappings. Keys are normalized header
 * tokens (lowercased, alphanumeric-only); the value is the target field.
 */
export const HEADER_SYNONYMS: Record<string, MappableField> = {
  // owner_number
  phone: "owner_number",
  phonenumber: "owner_number",
  mobile: "owner_number",
  cell: "owner_number",
  contactnumber: "owner_number",
  ownerphone: "owner_number",
  ownernumber: "owner_number",

  // owner_email
  email: "owner_email",
  owneremail: "owner_email",
  emailaddress: "owner_email",
  contactemail: "owner_email",

  // owner_name
  name: "owner_name",
  owner: "owner_name",
  ownername: "owner_name",
  fullname: "owner_name",
  contactname: "owner_name",

  // first_name
  first: "first_name",
  fname: "first_name",
  firstname: "first_name",
  givenname: "first_name",

  // last_name
  last: "last_name",
  lname: "last_name",
  lastname: "last_name",
  surname: "last_name",
  familyname: "last_name",

  // address
  address: "address",
  street: "address",
  streetaddress: "address",
  address1: "address",
  addressline1: "address",
  propertyaddress: "address",

  // city
  city: "city",
  town: "city",

  // state
  state: "state",
  st: "state",
  province: "state",
  region: "state",

  // zipcode
  zip: "zipcode",
  zipcode: "zipcode",
  postal: "zipcode",
  postalcode: "zipcode",

  // beds
  beds: "beds",
  bedrooms: "beds",
  bed: "beds",
  br: "beds",

  // baths
  baths: "baths",
  bathrooms: "baths",
  bath: "baths",
  ba: "baths",

  // rent_price
  rent: "rent_price",
  price: "rent_price",
  rentprice: "rent_price",
  monthlyrent: "rent_price",
  rentamount: "rent_price",

  // url
  url: "url",
  link: "url",
  listingurl: "url",
  zillowurl: "url",

  // zid
  zid: "zid",
  zpid: "zid",
  zillowid: "zid",
  listingid: "zid",
};

/** Normalize a header to the lookup form used in HEADER_SYNONYMS. */
export function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Best-effort field guess for a header. Returns null when unknown. */
export function suggestField(header: string): MappableField | null {
  const key = normalizeHeader(header);
  if (!key) return null;
  return HEADER_SYNONYMS[key] ?? null;
}
