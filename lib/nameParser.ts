export function splitOwnerName(ownerName: string | null | undefined): {
  first_name: string | null;
  last_name: string | null;
} {
  const t = (ownerName ?? "").trim();
  if (!t) return { first_name: null, last_name: null };
  const i = t.indexOf(" ");
  if (i === -1) return { first_name: t, last_name: null };
  return {
    first_name: t.slice(0, i).trim() || null,
    last_name: t.slice(i + 1).trim() || null,
  };
}
