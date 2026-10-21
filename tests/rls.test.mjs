import test from "node:test";
import assert from "node:assert/strict";

import { dbHarness } from "./helpers.mjs";

// No account can see another account's activity (amendment 1 §4), and seat
// labels never leave the consent schema through a client role. The sweep is
// driven by the schema: every column that points at an account or a user is
// checked, so a new table is covered the day it lands, and fails here until it
// is seeded.

const DB = "rls_sweep_test";
const A = "aaaaaaaa-0000-0000-0000-000000000000";
const B = "bbbbbbbb-0000-0000-0000-000000000000";
const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";

// Public by design: a vouch names an adult acting for a named co-op (0002).
const PUBLIC_BY_DESIGN = new Set(["public.coop_affiliations.account_id"]);

const { psql, admin, failure, asUser, ready, bootstrap } = dbHarness(DB);

test(
  "no account reads another account's rows, and no client reads seat labels",
  { skip: ready() ? false : "no local postgres; set TEST_DATABASE_URL" },
  async (t) => {
    bootstrap();
    t.after(() => admin(`drop database if exists ${DB} with (force)`));

    // Account A does everything an account can leave a trace of.
    psql(`
      insert into auth.users (id, email) values ('${USER_A}', 'a@test.local'), ('${USER_B}', 'b@test.local');
      insert into public.accounts (id, owner_user_id) values ('${A}', '${USER_A}'), ('${B}', '${USER_B}');
      insert into public.account_participants (account_id, class) values ('${A}', 'parent'), ('${B}', 'parent');
      insert into public.communication_waivers (account_id, version, sha256) values ('${A}', 't', '\\x00'), ('${B}', 't', '\\x00');
      insert into public.coop_listings (id, slug, name, enquiry_ref) values ('cccccccc-0000-0000-0000-000000000000', 'test-coop', 'Test co-op', 'ref');
      insert into public.user_roles (user_id, role, coop_listing_id) values ('${USER_A}', 'coop_director', 'cccccccc-0000-0000-0000-000000000000');
      insert into public.seats (account_id) values ('${A}');
      insert into public.listings (id, category, title, body, state_code, region, posted_by_account, posted_as) values
        ('dddddddd-0000-0000-0000-00000000000a', 'materials', 'Kit A', 'Synthetic listing body A.', 'TX', 'Austin', '${A}', 'parent'),
        ('dddddddd-0000-0000-0000-00000000000b', 'materials', 'Kit B', 'Synthetic listing body B.', 'TX', 'Austin', '${B}', 'parent');
      insert into public.listing_replies (listing_id, from_account, body) values ('dddddddd-0000-0000-0000-00000000000b', '${A}', 'Synthetic reply.');
      insert into public.listing_reports (listing_id, reason, reported_by) values ('dddddddd-0000-0000-0000-00000000000b', 'test', '${A}');
      insert into public.verification_attestations (account_id, method, vendor_evaluation_id) values ('${A}', 'socure_id_plus_docv', 'eval-test');
      insert into public.bookmarks (account_id, url, title) values ('${A}', 'https://example.test/', 'Kept');
      insert into public.abuse_events (account_id, kind, action) values ('${A}', 'rate_limit', 'blocked');
      insert into public.onboarding_checklists (account_id) values ('${A}');
      insert into public.entitlements (account_id, contract_id, plan_kind, billing_unit, term_start, price_ref) values ('${A}', 'c', 'family', 'household', '2026-11-01', 'p');
      insert into consent.notice_versions (version, sha256) values ('v1', '\\x00');
      insert into consent.consent_records (owner_user_id, account_id, notice_version, notice_acknowledged_at, seat_label) values ('${USER_A}', '${A}', 'v1', now(), 'lantern.k7q2');
      insert into public.user_roles (user_id, role) values ('${USER_A}', 'catalog_reviewer');
      insert into public.operator_reads (operator_user_id, listing_id, reason) values ('${USER_A}', 'dddddddd-0000-0000-0000-00000000000b', 'report');
      insert into public.catalog_candidates (id, kind, title, publisher, subject, url, source_url, retrieved_on, agent_run_id) values
        ('eeeeeeee-0000-0000-0000-00000000000a', 'curriculum', 'Test text', 'Test press', 'Math', 'https://example.test/a', 'https://example.test/a', '2026-10-21', 'run'),
        ('eeeeeeee-0000-0000-0000-00000000000b', 'resource', 'Test link', null, 'Math', 'https://example.test/b', 'https://example.test/b', '2026-10-21', 'run');
    `);
    asUser(USER_A, `select public.review_candidate('eeeeeeee-0000-0000-0000-00000000000a', true), public.review_candidate('eeeeeeee-0000-0000-0000-00000000000b', true);`);

    const columns = psql(`
      select c.conrelid::regclass || '.' || a.attname || '|' || case when c.confrelid = 'auth.users'::regclass then 'user' else 'account' end
        from pg_constraint c
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
       where c.contype = 'f' and c.confrelid in ('public.accounts'::regclass, 'auth.users'::regclass);`)
      .trim().split("\n").map((line) => line.split("|"));

    for (const [column, kind] of columns) {
      const [table, col] = [column.slice(0, column.lastIndexOf(".")), column.slice(column.lastIndexOf(".") + 1)];
      const qualified = table.includes(".") ? table : `public.${table}`;
      const key = `${qualified}.${col}`;
      const owner = kind === "user" ? USER_A : A;

      await t.test(key, () => {
        if (PUBLIC_BY_DESIGN.has(key)) return;
        assert.notEqual(psql(`select count(*) from ${qualified} where ${col} = '${owner}';`).trim(), "0", "seed this table above");
        const err = failure(USER_B, `select count(*) from ${qualified} where ${col} = '${owner}';`);
        if (err) assert.match(err, /permission denied/);
        else assert.equal(asUser(USER_B, `select count(*) from ${qualified} where ${col} = '${owner}';`), "0");
        const anon = (() => {
          try {
            return psql(`set role anon; select count(*) from ${qualified} where ${col} = '${owner}';`).split("\n").at(-2);
          } catch (err) {
            assert.match(String(err.stderr ?? err.message), /permission denied/);
            return "0";
          }
        })();
        assert.equal(anon, "0", "the anonymous role reads it");
      });
    }

    await t.test("the owner cannot read their own labels through a client role either", () => {
      assert.match(failure(USER_A, "select seat_label from consent.consent_records;") ?? "", /permission denied/);
      assert.match(failure(USER_A, "select consent.seat_code();") ?? "", /permission denied/);
    });
  },
);
