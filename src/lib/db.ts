import { Pool } from "pg";

/**
 * Direct Postgres, for the `consent` schema only. Supabase does not expose that
 * schema through PostgREST, which is the separation parental-consent.md §4
 * requires; routing it through the SDK would undo it.
 */
declare global {
  // eslint-disable-next-line no-var
  var __consentPool: Pool | undefined;
}

export function consentPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set; the consent record needs direct Postgres.");
  }

  // Reused across hot reloads, which would otherwise open a pool per edit.
  globalThis.__consentPool ??= new Pool({
    connectionString,
    max: 4,
    ssl: connectionString.includes("localhost") ? undefined : { rejectUnauthorized: true },
  });

  return globalThis.__consentPool;
}
