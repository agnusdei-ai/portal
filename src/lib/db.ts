import { Pool, type QueryResultRow } from "pg";

/**
 * Direct Postgres, for the `consent` schema only. Supabase does not expose that
 * schema through PostgREST, which is the separation parental-consent.md §4
 * requires; routing it through the SDK would undo it.
 */
declare global {
  var __consentPool: Pool | undefined;
}

function consentPool(): Pool {
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

// A pg error's detail quotes the failing row, seat label included, and whatever
// catches it may log it. Only the code and constraint name travel on.
export async function consentQuery<R extends QueryResultRow>(text: string, values: unknown[]) {
  try {
    return await consentPool().query<R>(text, values);
  } catch (err) {
    const { code, constraint } = err as { code?: string; constraint?: string };
    throw new Error(`consent query failed: ${code ?? "unknown"}${constraint ? ` (${constraint})` : ""}`);
  }
}
