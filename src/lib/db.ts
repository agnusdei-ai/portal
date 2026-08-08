import { Pool } from "pg";

/**
 * Direct Postgres access, used only for the `consent` schema.
 *
 * The consent record is not reachable through PostgREST, which is the point:
 * compliance/parental-consent.md §4 requires the record to be held separately,
 * and a schema Supabase does not expose cannot be reached by any client holding
 * any token. Exposing it to PostgREST to make the Supabase SDK usable here would
 * undo the separation the schema exists to create.
 *
 * Everything in the `public` schema goes through the Supabase client as usual.
 */
declare global {
  // eslint-disable-next-line no-var
  var __consentPool: Pool | undefined;
}

export function consentPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. The consent record requires direct Postgres access.",
    );
  }

  // Reused across hot reloads in development, where a new module instance would
  // otherwise open a fresh pool on every edit and exhaust connections.
  globalThis.__consentPool ??= new Pool({
    connectionString,
    max: 4,
    ssl: connectionString.includes("localhost") ? undefined : { rejectUnauthorized: true },
  });

  return globalThis.__consentPool;
}
