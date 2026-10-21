import test from "node:test";
import assert from "node:assert/strict";

import { dbHarness } from "./helpers.mjs";

// Co-op billing counts paying families by agreement ID and keeps no roster
// (amendment 2 §4.3).

const DB = "coop_billing_test";
const COOP = "cccccccc-0000-0000-0000-000000000000";
const FAMILIES = ["aaaaaaaa-0000-0000-0000-000000000001", "aaaaaaaa-0000-0000-0000-000000000002"];
const DIRECTOR = "dddddddd-0000-0000-0000-000000000000";
const USERS = ["11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222", "44444444-4444-4444-4444-444444444444"];
const { psql, admin, asUser, ready, bootstrap } = dbHarness(DB);

const entitle = (account, agreement) =>
  psql(`insert into public.entitlements (account_id, contract_id, plan_kind, billing_unit, term_start, price_ref)
        values ('${account}', '${agreement}', 'coop', 'family', '2026-11-01', 'p');`);
const refused = (fn) => {
  try {
    fn();
    return null;
  } catch (err) {
    return String(err.stderr ?? err.message);
  }
};

test(
  "co-op families are counted by agreement, never listed under a co-op",
  { skip: ready() ? false : "no local postgres; set TEST_DATABASE_URL" },
  async (t) => {
    bootstrap();
    t.after(() => admin(`drop database if exists ${DB} with (force)`));
    psql(`
      insert into auth.users (id, email) values ${USERS.map((u, i) => `('${u}', 'u${i}@test.local')`).join(", ")};
      insert into public.accounts (id, owner_user_id) values
        ('${FAMILIES[0]}', '${USERS[0]}'), ('${FAMILIES[1]}', '${USERS[1]}'), ('${DIRECTOR}', '${USERS[2]}');
      insert into public.coop_listings (id, slug, name, enquiry_ref) values ('${COOP}', 'test-coop', 'Test co-op', 'ref');
      insert into public.user_roles (user_id, role, coop_listing_id) values ('${USERS[2]}', 'coop_director', '${COOP}');`);

    await t.test("families under one agreement are a count", () => {
      for (const family of FAMILIES) entitle(family, "agreement-7f3k");
      assert.equal(psql("select count(distinct account_id) from public.entitlements where contract_id = 'agreement-7f3k' and status = 'active';").trim(), "2");
    });

    await t.test("an agreement ID may not name a listed co-op", () => {
      psql("update public.entitlements set status = 'ended';");
      assert.match(refused(() => entitle(FAMILIES[0], COOP)) ?? "", /must not name a co-op listing/);
      assert.match(refused(() => entitle(FAMILIES[0], "test-coop")) ?? "", /must not name a co-op listing/);
    });

    await t.test("a co-op director cannot see which families pay", () => {
      assert.equal(asUser(USERS[2], "select count(*) from public.entitlements;"), "0");
    });

    await t.test("nothing links a family account to a co-op", () => {
      const links = psql(`
        select c.conrelid::regclass || '.' || a.attname from pg_constraint c
          join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
         where c.contype = 'f' and c.confrelid = 'public.coop_listings'::regclass;`).trim();
      assert.equal(links, "coop_affiliations.coop_listing_id", "a new link to co-ops could hold a roster");
      assert.match(
        psql("select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.coop_affiliations'::regclass and contype = 'c';"),
        /teacher.*guide/,
        "affiliations name staff, never parents",
      );
    });
  },
);
