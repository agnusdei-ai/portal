import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";

/**
 * Behavioural tests: the schema executing, not the schema's text.
 *
 * The string-scanning suites assert that a migration says the right thing. These
 * assert that Postgres does the right thing, which is a different claim and the
 * one the safety properties actually rest on. Both bugs fixed in migration 0003
 * were invisible to a text scan and obvious on the first execution.
 *
 * Needs a migrated database: `npm run db:setup`. Skipped without TEST_DATABASE_URL
 * so the default suite still runs anywhere.
 */
const url = process.env.TEST_DATABASE_URL;
const pool = url ? new Pool({ connectionString: url, max: 2 }) : null;

const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";
const ACC_A = "aaaaaaaa-0000-0000-0000-000000000001";
const ACC_B = "aaaaaaaa-0000-0000-0000-000000000002";
const LISTING = "bbbbbbbb-0000-0000-0000-000000000001";

/** Runs `fn` as an authenticated user, then rolls back. */
async function asUser(uid, fn) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("set local role authenticated");
    await client.query(`set local "request.jwt.claims" = '{"sub":"${uid}"}'`);
    return await fn(client);
  } finally {
    await client.query("rollback").catch(() => {});
    client.release();
  }
}

async function rejects(uid, sql, params) {
  return asUser(uid, async (c) => {
    try {
      await c.query(sql, params);
      return null;
    } catch (err) {
      return err.message;
    }
  });
}

describe("schema behaviour", { skip: url ? false : "set TEST_DATABASE_URL" }, () => {
  before(async () => {
    // Separate statements: pg refuses multiple commands in a parameterised query.
    await pool.query(
      "insert into auth.users (id, email) values ($1,'a@example.com'), ($2,'b@example.com') on conflict (id) do nothing",
      [USER_A, USER_B],
    );
    await pool.query(
      "insert into public.accounts (id, owner_user_id) values ($1,$2), ($3,$4) on conflict (id) do nothing",
      [ACC_A, USER_A, ACC_B, USER_B],
    );
    await pool.query(
      "insert into public.account_participants (account_id, class) values ($1,'parent'), ($2,'parent') on conflict do nothing",
      [ACC_A, ACC_B],
    );
    await pool.query(
      "insert into public.communication_waivers (account_id, version, sha256) values ($1,'v1','\\x00') on conflict (account_id) do nothing",
      [ACC_A],
    );
    await pool.query(
      `insert into public.listings
         (id, category, title, body, state_code, region, posted_by_account, posted_as)
       values ($1,'materials','Saxon 7/6','Good condition, meeting centrally.','TX','North Dallas',$2,'parent')
       on conflict (id) do nothing`,
      [LISTING, ACC_A],
    );
  });

  after(async () => pool.end());

  test("a reader cannot see who posted a listing", async () => {
    const err = await rejects(USER_B, "select posted_by_account from public.listings");
    assert.match(
      err ?? "",
      /permission denied/,
      "portal.md §12 and the waiver both promise this column is never shown to a reader.",
    );
  });

  test("select * is refused, so the column cannot leak by default", async () => {
    const err = await rejects(USER_B, "select * from public.listings");
    assert.match(err ?? "", /permission denied/);
  });

  test("a reader can still read the listing itself", async () => {
    const rows = await asUser(USER_B, (c) =>
      c.query("select title, region from public.listings").then((r) => r.rows),
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].title, "Saxon 7/6");
  });

  test("an author can withdraw their own listing", async () => {
    const res = await asUser(USER_A, (c) =>
      c.query("update public.listings set state = 'withdrawn' where id = $1", [LISTING]),
    );
    assert.equal(res.rowCount, 1, "The waiver promises withdrawal stops listings being shown.");
  });

  test("a stranger cannot withdraw someone else's listing", async () => {
    const res = await asUser(USER_B, (c) =>
      c.query("update public.listings set state = 'removed' where id = $1", [LISTING]),
    );
    assert.equal(res.rowCount, 0);
  });

  test("replying without an accepted waiver is refused", async () => {
    // Account B has no waiver row.
    const err = await rejects(
      USER_B,
      "insert into public.listing_replies (listing_id, from_account, body) values ($1,$2,'Still available?')",
      [LISTING, ACC_B],
    );
    assert.match(err ?? "", /waiver has not been accepted/);
  });

  test("posting in a class the account does not hold is refused", async () => {
    const err = await rejects(
      USER_A,
      `insert into public.listings
         (category, title, body, state_code, region, posted_by_account, posted_as)
       values ('class_offering','Latin I','Weekly, starting September.','TX','North Dallas',$1,'teacher')`,
      [ACC_A],
    );
    assert.match(err ?? "", /does not hold the participant class/);
  });

  test("no participant class reaches a child", async () => {
    const { rows } = await pool.query(
      "select unnest(enum_range(null::participant_class))::text as class",
    );
    const classes = rows.map((r) => r.class);
    assert.deepEqual(classes.sort(), ["coop", "guide", "parent", "teacher"]);
  });

  test("the axis table contains no pair we did not agree", async () => {
    const { rows } = await pool.query("select a::text, b::text from public.permitted_axes");
    const pairs = rows.map((r) => `${r.a}->${r.b}`).sort();
    assert.deepEqual(pairs, [
      "coop->guide",
      "guide->coop",
      "parent->parent",
      "parent->teacher",
      "teacher->parent",
    ]);
  });

  test("the consent record is unreachable from the client roles", async () => {
    const err = await rejects(USER_A, "select * from consent.consent_records");
    assert.match(
      err ?? "",
      /permission denied/,
      "parental-consent.md §4 requires the record to be held separately.",
    );
  });

  test("a consent cannot be marked granted without its evidence", async () => {
    try {
      await pool.query(
        `insert into consent.consent_records
           (owner_user_id, notice_version, notice_acknowledged_at, child_account_name, state)
         values ($1,'v1',now(),'Cecilia','granted')`,
        [USER_A],
      );
      assert.fail("A granted consent with no processor reference must not be storable.");
    } catch (err) {
      assert.match(err.message, /granted_is_evidenced|violates foreign key/);
    }
  });
});
