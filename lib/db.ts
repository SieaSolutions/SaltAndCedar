import { neon } from "@neondatabase/serverless";

let cached: ReturnType<typeof neon> | null = null;

function client() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (!cached) cached = neon(url);
  return cached;
}

/**
 * Neon tagged-template queries always resolve to an array of row objects at runtime.
 * The driver's conditional typing surfaces `FullQueryResults` unless narrowed — we cast once here.
 */
export async function sql<T extends Record<string, unknown> = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...params: unknown[]
): Promise<T[]> {
  const rows = await client()(strings, ...params);
  return rows as T[];
}
