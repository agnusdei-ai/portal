import test from "node:test";
import assert from "node:assert/strict";

import { dbHarness } from "./helpers.mjs";

const DB = "entitlement_test";
const ACCOUNT_A = "aaaaaaaa-0000-0000-0000-000000000000";
const ACCOUNT_B = "bbbbbbbb-0000-0000-0000-000000000000";
const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";

const { psql, admin, asUser, failure, ready, bootstrap } = dbHarness(DB);

const grant = (account, plan, unit, extra = "") =>
  psql(
    `insert into public.entitlements (account_id, contract_id, plan_kind, billing_unit, term_start, price_ref${extra ? ", " + extra.split("=")[0] : ""})
     values ('${account}', 'contract-test', '${plan}', '${unit}', '2026-11-01', 'price-ref-test'${extra ? ", " + extra.split("=")[1] : ""})
     returning allow_faith_content;`,
  ).split("\n")[0];
const refused = (fn) => {
  try {
    fn();
    return null;
  } catch (err) {
    return String(err.stderr ?? err.message);
  }
};

test(
  "entitlements come from the contract and only the owner reads them",
  { skip: ready() ? false : "no local postgres; set TEST_DATABASE_URL" },
  async (t) => {
    bootstrap();
    t.after(() => admin(`drop database if exists ${DB} with (force)`));
    psql(
      `insert into auth.users (id, email) values ('${USER_A}', 'a@test.local'), ('${USER_B}', 'b@test.local');
       insert into public.accounts (id, owner_user_id) values ('${ACCOUNT_A}', '${USER_A}'), ('${ACCOUNT_B}', '${USER_B}');`,
    );

    await t.test("faith content defaults on for families and off for schools", () => {
      assert.equal(grant(ACCOUNT_A, "family", "household"), "t");
      assert.equal(grant(ACCOUNT_B, "per_learner", "learner"), "f");
    });

    await t.test("only the owner reads an entitlement", () => {
      assert.equal(asUser(USER_A, "select plan_kind from public.entitlements;"), "family");
      assert.equal(asUser(USER_B, "select plan_kind from public.entitlements;"), "per_learner");
      assert.equal(psql("set role anon; select count(*) from public.entitlements;").split("\n").at(-2), "0");
    });

    await t.test("an account cannot grant or change its own entitlement", () => {
      assert.match(
        failure(USER_A, `insert into public.entitlements (account_id, contract_id, plan_kind, billing_unit, term_start, price_ref) values ('${ACCOUNT_A}', 'x', 'campus', 'campus', '2026-11-01', 'x');`) ?? "",
        /row-level security/,
      );
      assert.equal(asUser(USER_A, "update public.entitlements set status = 'ended' returning id;"), "UPDATE 0");
      assert.equal(psql("select status from public.entitlements where account_id = '" + ACCOUNT_A + "';").trim(), "active");
    });

    await t.test("terms are fixed; a change is a new entitlement", () => {
      assert.match(refused(() => psql(`update public.entitlements set price_ref = 'other' where account_id = '${ACCOUNT_A}';`)) ?? "", /terms are fixed/);
      assert.match(refused(() => grant(ACCOUNT_A, "coop", "family")) ?? "", /entitlements_one_active_idx/);
      psql(`update public.entitlements set status = 'ended', term_end = '2027-11-01' where account_id = '${ACCOUNT_A}';`);
      assert.equal(grant(ACCOUNT_A, "coop", "family"), "t");
    });

    await t.test("a null seat cap is unlimited and a zero cap is refused", () => {
      assert.equal(psql(`select seat_cap is null from public.entitlements where account_id = '${ACCOUNT_B}';`).trim(), "t");
      psql(`update public.entitlements set status = 'ended' where account_id = '${ACCOUNT_B}';`);
      assert.match(refused(() => grant(ACCOUNT_B, "campus", "campus", "seat_cap=0")) ?? "", /seat_cap_check/);
    });

    await t.test("no column holds an amount", () => {
      assert.equal(
        psql(`select count(*) from information_schema.columns where table_name = 'entitlements' and data_type in ('numeric', 'money', 'integer', 'bigint') and column_name <> 'seat_cap';`).trim(),
        "0",
      );
    });
  },
);
