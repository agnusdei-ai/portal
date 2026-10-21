import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Comments in these files explain what the schema refuses to hold, and so name
 * the very things it refuses to hold. The invariants are about code.
 */
export function readStripped(url) {
  return readFileSync(url, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/(--|\/\/).*$/, ""))
    .join("\n");
}

/**
 * Loads a TypeScript module so tests run the real functions. The suite already
 * runs under tsx (package.json), which transpiles on import, so no in-memory
 * compiler is needed; TypeScript 7 removed the transpileModule API the old
 * version of this leaned on. Modules loaded this way should stay import-free
 * of server-only code, which fails loudly on import if it is reached for.
 */
export function loadModule(url) {
  return import(url.href);
}


/**
 * The RLS test harness: a fresh database per test file, the real migrations,
 * and queries run as the `authenticated` role wearing an account's JWT claims —
 * the application's exact posture. The table owner bypasses RLS, so a query
 * run as owner proves nothing; every actor query goes through `asUser`.
 *
 * Postgres comes from TEST_DATABASE_URL (CI). Without one, `ready` is false and
 * the caller skips rather than pretends.
 */
export function dbHarness(db) {
  const base = process.env.TEST_DATABASE_URL;

  function psql(database, sql) {
    const target = base ? `${base.replace(/\/+$/, "")}/${database}` : database;
    // The target is psql's first positional; a leading program name turns the
    // URL into a username and the availability probe swallows the failure.
    const args = base
      ? ["-v", "ON_ERROR_STOP=1", "-tA", target]
      : ["-u", "postgres", "psql", database, "-v", "ON_ERROR_STOP=1", "-tA"];
    return execFileSync(base ? "psql" : "sudo", args, { input: sql, encoding: "utf8" });
  }

  function asUser(sub, sql) {
    return psql(
      db,
      `set role authenticated; set request.jwt.claims = '${JSON.stringify({ sub, role: "authenticated" })}';\n${sql}`,
    )
      .split("\n")
      // psql echoes each SET's tag, and writes append theirs (INSERT 0 1);
      // the queries' own output is all that remains.
      .filter((line) => line !== "SET" && !/^(INSERT|UPDATE|DELETE) \d+ \d+$/.test(line))
      .join("\n")
      .trim();
  }

  /** The message an actor query failed with, or null if it succeeded. */
  function failure(sub, sql) {
    try {
      asUser(sub, sql);
      return null;
    } catch (err) {
      return String(err.stderr ?? err.message);
    }
  }

  function ready() {
    try {
      psql("postgres", "select 1");
      return true;
    } catch {
      return false;
    }
  }

  /** Drop, create, stub (grants first), then every migration in order. */
  function bootstrap() {
    try {
      psql("postgres", `drop database if exists ${db} with (force)`);
    } catch {
      // "if exists" already said a missing database is not an error.
    }
    psql("postgres", `create database ${db}`);
    psql(db, readFileSync("tests/fixtures/auth-stub.sql", "utf8"));
    for (const file of readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort()) {
      psql(db, readFileSync(join("supabase/migrations", file), "utf8"));
    }
  }

  return { psql: (sql) => psql(db, sql), admin: (sql) => psql("postgres", sql), asUser, failure, ready, bootstrap };
}
