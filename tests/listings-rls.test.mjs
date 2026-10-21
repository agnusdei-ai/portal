import test from "node:test";
import assert from "node:assert/strict";

import { dbHarness } from "./helpers.mjs";

/**
 * The two defects migration 0008 fixes, pinned against a real Postgres. Both
 * were invisible to the text-scanning suites and obvious on first execution.
 */
const DB = "listings_rls_test";
const { psql, asUser, failure, ready, bootstrap } = dbHarness(DB);

const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";
const USER_C = "33333333-3333-3333-3333-333333333333"; // never accepted the waiver
const ACC_A = "aaaaaaaa-0000-0000-0000-000000000001";
const ACC_B = "aaaaaaaa-0000-0000-0000-000000000002";
const ACC_C = "aaaaaaaa-0000-0000-0000-000000000003";
const LISTING = "bbbbbbbb-0000-0000-0000-000000000001";

test(
  "a listing never reveals its poster, and an author can withdraw their own",
  { skip: ready() ? false : "no local postgres; set TEST_DATABASE_URL" },
  async (t) => {
    bootstrap();

    // Seeded as owner: accounts and classes exist only behind operator acts.
    psql(`
      insert into auth.users (id, email) values ('${USER_A}','a@test.local'), ('${USER_B}','b@test.local'), ('${USER_C}','c@test.local');
      insert into public.accounts (id, owner_user_id) values ('${ACC_A}','${USER_A}'), ('${ACC_B}','${USER_B}'), ('${ACC_C}','${USER_C}');
      insert into public.account_participants (account_id, class) values ('${ACC_A}','parent'), ('${ACC_B}','parent'), ('${ACC_C}','parent');
      insert into public.communication_waivers (account_id, version, sha256) values ('${ACC_A}','v1','\\x00'), ('${ACC_B}','v1','\\x00');
      insert into public.listings (id, category, title, body, state_code, region, posted_by_account, posted_as)
        values ('${LISTING}','materials','Saxon 7/6','Good condition, meeting centrally.','TX','North Dallas','${ACC_A}','parent');
    `);

    await t.test("a reader cannot select the poster column", () => {
      assert.match(
        failure(USER_B, "select posted_by_account from public.listings;") ?? "",
        /permission denied/,
        "portal.md §12 and the waiver both promise this column is never shown.",
      );
    });

    await t.test("select * on the table is refused, so the column cannot leak by default", () => {
      assert.match(failure(USER_B, "select * from public.listings;") ?? "", /permission denied/);
    });

    await t.test("the view carries the listing and a computed mine, never the id", () => {
      assert.equal(asUser(USER_B, `select title, mine from public.listings_v;`), "Saxon 7/6|f");
      assert.equal(asUser(USER_A, `select mine from public.listings_v where id = '${LISTING}';`), "t");
      assert.match(failure(USER_B, "select posted_by_account from public.listings_v;") ?? "", /does not exist/);
    });

    await t.test("replies read through the view: visible to the two parties, each knowing only which are theirs", () => {
      asUser(USER_B, `insert into public.listing_replies (listing_id, from_account, body) values ('${LISTING}','${ACC_B}','Still available?');`);
      assert.equal(asUser(USER_A, `select body, mine from public.listing_replies_v;`), "Still available?|f");
      assert.equal(asUser(USER_B, `select body, mine from public.listing_replies_v;`), "Still available?|t");
      assert.equal(asUser(USER_C, `select count(*) from public.listing_replies_v;`), "0");
      assert.match(failure(USER_A, "select from_account from public.listing_replies;") ?? "", /permission denied/);
    });

    await t.test("a stranger cannot withdraw someone else's listing", () => {
      assert.equal(
        asUser(USER_B, `update public.listings set state = 'removed' where id = '${LISTING}';`),
        "UPDATE 0",
      );
    });

    await t.test("an author can withdraw their own listing, and still sees it", () => {
      assert.equal(
        asUser(USER_A, `update public.listings set state = 'withdrawn' where id = '${LISTING}';`),
        "UPDATE 1",
        "withdrawWaiver depends on this; the waiver promises withdrawal stops listings being shown.",
      );
      assert.equal(asUser(USER_A, `select state from public.listings_v where id = '${LISTING}';`), "withdrawn");
      assert.equal(asUser(USER_B, `select count(*) from public.listings_v;`), "0");
    });

    await t.test("replying without an accepted waiver is refused", () => {
      assert.match(
        failure(USER_C, `insert into public.listing_replies (listing_id, from_account, body) values ('${LISTING}','${ACC_C}','Is this still available?');`) ?? "",
        /waiver has not been accepted/,
      );
    });

    await t.test("posting in a class the account does not hold is refused", () => {
      assert.match(
        failure(USER_A, `insert into public.listings (category, title, body, state_code, region, posted_by_account, posted_as) values ('class_offering','Latin I','Weekly, from September.','TX','North Dallas','${ACC_A}','teacher');`) ?? "",
        /does not hold the participant class/,
      );
    });

    await t.test("the consent record is unreachable from the client roles", () => {
      assert.match(failure(USER_A, "select * from consent.consent_records;") ?? "", /permission denied/);
    });

    await t.test("a consent cannot be marked granted without its evidence", () => {
      assert.throws(
        () => psql(`insert into consent.consent_records (owner_user_id, notice_version, notice_acknowledged_at, seat_label, state) values ('${USER_A}','v1',now(),'lantern.k7q2','granted');`),
        (err) => /granted_is_evidenced|violates/.test(String(err.stderr ?? err.message)),
      );
    });
  },
);
