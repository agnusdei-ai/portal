import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

/**
 * Bookmarks are private to the account that kept them (spec: bookmarks —
 * "RLS policy makes cross-account reads structurally impossible, not just
 * unrendered"). This test runs the real migrations against a real Postgres
 * and speaks to the database the way the application does: as the
 * `authenticated` role wearing each account's JWT claims. The owner of the
 * tables bypasses row-level security, so every actor query goes through
 * `set role authenticated` — a failure to isolate is a test failure, not a
 * test artifact.
 *
 * Postgres comes from TEST_DATABASE_URL (CI service container). Without one,
 * the test skips rather than pretends: a skipped invariant is visible, a
 * silently green one is not honest.
 */

const DB = "bookmarks_rls_test";
const BASE = process.env.TEST_DATABASE_URL;

const ACCOUNT_A = "aaaaaaaa-0000-0000-0000-000000000000";
const ACCOUNT_B = "bbbbbbbb-0000-0000-0000-000000000000";
const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";

function psql(database, sql) {
  const target = BASE ? `${BASE.replace(/\/+$/, "")}/${database}` : database;
  const args = BASE
    ? ["psql", "-v", "ON_ERROR_STOP=1", "-tA", target]
    : ["-u", "postgres", "psql", database, "-v", "ON_ERROR_STOP=1", "-tA"];
  return execFileSync(BASE ? "psql" : "sudo", args, {
    input: sql,
    encoding: "utf8",
  });
}

/** As the authenticated role wearing `sub`'s claims — the app's exact posture. */
function asUser(sub, sql) {
  return psql(
    DB,
    `set role authenticated; set request.jwt.claims = '${JSON.stringify({ sub, role: "authenticated" })}';\n${sql}`,
  )
    // psql echoes each SET's command tag; the queries' own output follows it.
    .split("\n")
    .filter((line) => line !== "SET")
    .join("\n")
    .trim();
}

function postgresAvailable() {
  try {
    psql("postgres", "select 1");
    return true;
  } catch {
    return false;
  }
}

const ready = postgresAvailable();

test(
  "bookmarks are private to their account",
  { skip: ready ? false : "no local postgres; set TEST_DATABASE_URL" },
  async (t) => {
    // Fresh database, real migrations, the stub's grants applied last so every
    // table — including this PR's — is covered by them.
    try {
      psql("postgres", `drop database if exists ${DB} with (force)`);
    } catch {
      // A missing database is not an error; "if exists" already said so.
    }
    psql("postgres", `create database ${DB}`);

    psql(DB, readFileSync("tests/fixtures/auth-stub.sql", "utf8"));
    for (const file of readdirSync("supabase/migrations")
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      psql(DB, readFileSync(join("supabase/migrations", file), "utf8"));
    }
    psql(DB, readFileSync("tests/fixtures/auth-stub.sql", "utf8"));

    // Accounts exist only behind the webhook in production; seeding them as the
    // table owner mirrors the service role's write, not a user's.
    psql(
      DB,
      `insert into auth.users (id, email) values ('${USER_A}', 'a@test.local'), ('${USER_B}', 'b@test.local');
       insert into public.accounts (id, owner_user_id) values ('${ACCOUNT_A}', '${USER_A}'), ('${ACCOUNT_B}', '${USER_B}');`,
    );

    // Account A saves a bookmark the way the application would: as the
    // authenticated role, claiming only its own account.
    asUser(
      USER_A,
      `insert into public.bookmarks (account_id, url, title, source_label, subject)
       values ('${ACCOUNT_A}', 'https://example.test/algebra', 'Algebra manipulatives', 'via web', 'math');`,
    );

    t.test("another account's bookmark never renders", () => {
      assert.equal(asUser(USER_B, "select count(*) from public.bookmarks;").trim(), "0");
      assert.equal(asUser(USER_A, "select count(*) from public.bookmarks;").trim(), "1");
    });

    await t.test("another account cannot update, delete, or claim it", () => {
      const update = asUser(
        USER_B,
        `update public.bookmarks set note = 'hijacked' where account_id = '${ACCOUNT_A}' returning id;`,
      );
      assert.equal(update, "UPDATE 0", "update reached another account's row");

      const del = asUser(
        USER_B,
        `delete from public.bookmarks where account_id = '${ACCOUNT_A}' returning id;`,
      );
      assert.equal(del, "DELETE 0", "delete reached another account's row");

      assert.throws(
        () =>
          asUser(
            USER_B,
            `insert into public.bookmarks (account_id, url, title) values ('${ACCOUNT_A}', 'https://example.test/planted', 'planted');`,
          ),
        /row-level security/,
        "a foreign account_id row was accepted",
      );
    });

    await t.test("the owner's row is intact after all of it", () => {
      const row = asUser(USER_A, "select title, note from public.bookmarks;");
      assert.equal(row, "Algebra manipulatives|");
    });

    t.after(() => {
      psql("postgres", `drop database if exists ${DB} with (force)`);
    });
  },
);
