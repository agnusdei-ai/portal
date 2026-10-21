import test from "node:test";
import assert from "node:assert/strict";

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { dbHarness } from "./helpers.mjs";

const DB = "seat_cap_test";
const CAPPED = "aaaaaaaa-0000-0000-0000-000000000000";
const OPEN = "bbbbbbbb-0000-0000-0000-000000000000";
const BARE = "cccccccc-0000-0000-0000-000000000000";
const { psql, admin, ready, bootstrap } = dbHarness(DB);

const issue = (account) => psql(`insert into public.seats (account_id) values ('${account}') returning id;`).split("\n")[0];
const refused = (fn) => {
  try {
    fn();
    return null;
  } catch (err) {
    return String(err.stderr ?? err.message);
  }
};

test(
  "a contract's seat cap holds and a null cap is unlimited",
  { skip: ready() ? false : "no local postgres; set TEST_DATABASE_URL" },
  async (t) => {
    bootstrap();
    t.after(() => admin(`drop database if exists ${DB} with (force)`));
    psql(`
      insert into auth.users (id, email) values
        ('11111111-1111-1111-1111-111111111111', 'a@test.local'),
        ('22222222-2222-2222-2222-222222222222', 'b@test.local'),
        ('33333333-3333-3333-3333-333333333333', 'c@test.local');
      insert into public.accounts (id, owner_user_id) values
        ('${CAPPED}', '11111111-1111-1111-1111-111111111111'),
        ('${OPEN}', '22222222-2222-2222-2222-222222222222'),
        ('${BARE}', '33333333-3333-3333-3333-333333333333');
      insert into public.entitlements (account_id, contract_id, plan_kind, billing_unit, seat_cap, term_start, price_ref) values
        ('${CAPPED}', 'c', 'per_learner', 'learner', 2, '2026-11-01', 'p'),
        ('${OPEN}', 'c', 'campus', 'campus', null, '2026-11-01', 'p');`);

    await t.test("the cap admits seats up to its value and refuses the next", () => {
      issue(CAPPED);
      const second = issue(CAPPED);
      assert.match(refused(() => issue(CAPPED)) ?? "", /seat cap of 2 reached/);
      psql(`update public.seats set state = 'revoked' where id = '${second}';`);
      issue(CAPPED);
      assert.match(refused(() => psql(`update public.seats set state = 'active' where id = '${second}';`)) ?? "", /seat cap/);
    });

    await t.test("a null cap is unlimited enrolled seats", () => {
      for (let i = 0; i < 30; i++) issue(OPEN);
      assert.equal(psql(`select count(*) from public.seats where account_id = '${OPEN}';`).trim(), "30");
    });

    await t.test("an account without a contract keeps per-purchase seats", () => {
      issue(BARE);
      issue(BARE);
    });
  },
);

// Unlimited enrolled seats are not unlimited simultaneous use, which appliance
// capacity qualifies per workload. Copy that says one must say the other.
test("no copy claims unlimited without saying enrolled seats", () => {
  const files = (dir) =>
    readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? files(p) : /\.(tsx?|md)$/.test(n) ? [p] : [];
    });
  const offences = files("src").filter((f) => {
    const text = readFileSync(f, "utf8");
    return /unlimited/i.test(text) && !/unlimited enrolled seats/i.test(text);
  });
  assert.deepEqual(offences, []);
});
