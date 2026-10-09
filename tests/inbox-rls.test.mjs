import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

/**
 * The inbox renders exactly the replies row-level security returns —
 * "reply visible to the two parties" (0001_zones.sql) is the whole permission
 * system, so this test runs the real migrations against a real Postgres and
 * speaks to the database the way the application's data layer does: as the
 * `authenticated` role wearing each account's JWT claims, never as the table
 * owner (who bypasses RLS and would make every assertion vacuous).
 *
 * Three views are pinned, per the spec's inbox region:
 *   - a listing owner sees the replies to their listings;
 *   - a parent sees their own replies (including on listings they do not own);
 *   - nobody else — a bystander parent, or the anonymous role — sees any of it.
 *
 * And the write side, which is why the read can be trusted: a reply from a
 * non-permitted participant axis is refused by the 0002 trigger, so no such
 * reply ever exists to render.
 *
 * Postgres comes from TEST_DATABASE_URL (CI service container). Without one,
 * the test skips rather than pretends: a skipped invariant is visible, a
 * silently green one is not honest.
 */

const DB = "inbox_rls_test";
const BASE = process.env.TEST_DATABASE_URL;

const OWNER = "aaaaaaaa-0000-0000-0000-000000000001"; // posts a materials listing
const FRIEND = "aaaaaaaa-0000-0000-0000-000000000002"; // replies to it; posts their own
const BYSTANDER = "aaaaaaaa-0000-0000-0000-000000000003"; // sees nothing
const COOPDIR = "aaaaaaaa-0000-0000-0000-000000000004"; // posts as a co-operative

const USER_OWNER = "11111111-1111-1111-1111-111111111111";
const USER_FRIEND = "22222222-2222-2222-2222-222222222222";
const USER_BYSTANDER = "33333333-3333-3333-3333-333333333333";
const USER_COOPDIR = "44444444-4444-4444-4444-444444444444";

function psql(database, sql) {
  const target = BASE ? `${BASE.replace(/\/+$/, "")}/${database}` : database;
  // Same harness rule as bookmarks-rls.test.mjs: the target is psql's first
  // positional; a leading program name turns the URL into a username.
  const args = BASE
    ? ["-v", "ON_ERROR_STOP=1", "-tA", target]
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
    .split("\n")
    // psql echoes each SET's command tag, and write statements append theirs
    // (INSERT 0 1); the queries' own output — including a `returning id` —
    // is all that remains.
    .filter((line) => line !== "SET" && !/^(INSERT|UPDATE|DELETE) \d+ \d+$/.test(line))
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
  "the inbox renders exactly the replies the participant axes permit",
  { skip: ready ? false : "no local postgres; set TEST_DATABASE_URL" },
  async (t) => {
    // Fresh database, real migrations, the stub's grants applied last so every
    // table is covered by them.
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

    // Accounts, participant classes and affiliations exist only behind
    // operator-side acts in production (the webhook, vouching); seeding them
    // as the table owner mirrors the service role, not a user.
    psql(
      DB,
      `insert into auth.users (id, email) values
         ('${USER_OWNER}', 'owner@test.local'),
         ('${USER_FRIEND}', 'friend@test.local'),
         ('${USER_BYSTANDER}', 'bystander@test.local'),
         ('${USER_COOPDIR}', 'coopdir@test.local');
       insert into public.accounts (id, owner_user_id) values
         ('${OWNER}', '${USER_OWNER}'),
         ('${FRIEND}', '${USER_FRIEND}'),
         ('${BYSTANDER}', '${USER_BYSTANDER}'),
         ('${COOPDIR}', '${USER_COOPDIR}');
       insert into public.account_participants (account_id, class) values
         ('${OWNER}', 'parent'),
         ('${FRIEND}', 'parent'),
         ('${BYSTANDER}', 'parent'),
         ('${COOPDIR}', 'coop');`,
    );

    // Everyone who will post or reply accepts the communication waiver the way
    // the application would: as the authenticated role, for their own account.
    for (const user of [USER_OWNER, USER_FRIEND, USER_COOPDIR]) {
      asUser(
        user,
        `insert into public.communication_waivers (account_id, version, sha256)
         values (public.current_account_id(), 'test', decode('00', 'hex'));`,
      );
    }

    // Owner posts a materials listing; Friend replies to it.
    const OWNER_LISTING = asUser(
      USER_OWNER,
      `insert into public.listings (category, title, body, state_code, region, posted_by_account, posted_as)
       values ('materials', 'Saxon Algebra 1/2 kit', 'Third edition, solutions manual included. Pickup or posted materials trade.', 'TX', 'Austin', public.current_account_id(), 'parent')
       returning id;`,
    ).trim();

    asUser(
      USER_FRIEND,
      `insert into public.listing_replies (listing_id, from_account, body)
       values ('${OWNER_LISTING}', public.current_account_id(), 'Still available? I can trade the art supplies.');`,
    );

    // Friend posts their own listing; Owner replies to it. After this, each of
    // the two sees two replies by two different RLS branches.
    const FRIEND_LISTING = asUser(
      USER_FRIEND,
      `insert into public.listings (category, title, body, state_code, region, posted_by_account, posted_as)
       values ('materials', 'Art supplies lot', 'Watercolors, brushes and drawing paper, used one term. Happy to trade.', 'TX', 'Austin', public.current_account_id(), 'parent')
       returning id;`,
    ).trim();

    asUser(
      USER_OWNER,
      `insert into public.listing_replies (listing_id, from_account, body)
       values ('${FRIEND_LISTING}', public.current_account_id(), 'Very interested in the brushes if the kit trade falls through.');`,
    );

    await t.test("a listing owner sees the replies to their listings", () => {
      const rows = asUser(USER_OWNER, `select body from public.listing_replies;`);
      assert.match(rows, /Still available\? I can trade the art supplies\./);
    });

    await t.test("a parent sees their own replies, on listings they do not own", () => {
      const rows = asUser(
        USER_OWNER,
        `select body from public.listing_replies order by body;`,
      );
      assert.match(rows, /Very interested in the brushes/);
      const count = asUser(USER_OWNER, `select count(*) from public.listing_replies;`).trim();
      assert.equal(count, "2", "the owner view and the own-reply view union, not overwrite");
    });

    await t.test("the replying parent's view is the same two rows, no more", () => {
      const count = asUser(USER_FRIEND, `select count(*) from public.listing_replies;`).trim();
      assert.equal(count, "2");
    });

    await t.test("a bystander account sees none of it", () => {
      const count = asUser(USER_BYSTANDER, `select count(*) from public.listing_replies;`).trim();
      assert.equal(count, "0", "there is no thread anyone can browse");
    });

    await t.test("the anonymous role reads no replies", () => {
      const count = psql(
        DB,
        `set role anon; select count(*) from public.listing_replies;`,
      )
        .split("\n")
        .filter((l) => l !== "SET")
        .join("\n")
        .trim();
      assert.equal(count, "0");
    });

    await t.test("a reply from a non-permitted axis never renders", () => {
      // The co-operative posts an opening as an institution; the parent's
      // reply has no (parent, coop) axis in permitted_axes, so the 0002
      // trigger refuses the write.
      const COOP_LISTING = asUser(
        USER_COOPDIR,
        `insert into public.listings (category, title, body, state_code, region, posted_by_account, posted_as)
         values ('coop_opening', 'Bluebonnet co-op has room', 'Two families welcome for Tuesday labs this spring term.', 'TX', 'Austin', public.current_account_id(), 'coop')
         returning id;`,
      ).trim();

      assert.throws(
        () =>
          asUser(
            USER_FRIEND,
            `insert into public.listing_replies (listing_id, from_account, body)
             values ('${COOP_LISTING}', public.current_account_id(), 'Could we join?');`,
          ),
        /no permitted communication axis/,
        "the axis trigger let an off-axis reply through",
      );

      // Nothing was written, so nothing renders in either inbox.
      assert.equal(
        asUser(USER_FRIEND, `select count(*) from public.listing_replies;`).trim(),
        "2",
      );
      assert.equal(
        asUser(USER_COOPDIR, `select count(*) from public.listing_replies;`).trim(),
        "0",
      );
    });

    t.after(() => {
      psql("postgres", `drop database if exists ${DB} with (force)`);
    });
  },
);
