import test from "node:test";
import assert from "node:assert/strict";

import { dbHarness } from "./helpers.mjs";

const DB = "catalog_scope_test";
const REVIEWER = "11111111-1111-1111-1111-111111111111";
const SCHOOL = ["aaaaaaaa-0000-0000-0000-000000000001", "22222222-2222-2222-2222-222222222222"];
const ALLOWED = ["aaaaaaaa-0000-0000-0000-000000000002", "33333333-3333-3333-3333-333333333333"];
const FAMILY = ["aaaaaaaa-0000-0000-0000-000000000003", "44444444-4444-4444-4444-444444444444"];
const { psql, admin, asUser, ready, bootstrap } = dbHarness(DB);

const visible = (user) => asUser(user, "select string_agg(title, ',' order by title) from public.curricula;");

test(
  "school accounts do not see faith content unless the contract allows it",
  { skip: ready() ? false : "no local postgres; set TEST_DATABASE_URL" },
  async (t) => {
    bootstrap();
    t.after(() => admin(`drop database if exists ${DB} with (force)`));
    const accounts = [SCHOOL, ALLOWED, FAMILY];
    psql(`
      insert into auth.users (id, email) values ('${REVIEWER}', 'r@test.local'), ${accounts.map(([, u], i) => `('${u}', 'u${i}@test.local')`).join(", ")};
      insert into public.accounts (id, owner_user_id) values ${accounts.map(([a, u]) => `('${a}', '${u}')`).join(", ")};
      insert into public.entitlements (account_id, contract_id, plan_kind, billing_unit, term_start, price_ref, allow_faith_content) values
        ('${SCHOOL[0]}', 'c1', 'campus', 'campus', '2026-11-01', 'p', null),
        ('${ALLOWED[0]}', 'c2', 'campus', 'campus', '2026-11-01', 'p', true),
        ('${FAMILY[0]}', 'c3', 'family', 'household', '2026-11-01', 'p', null);
      insert into public.user_roles (user_id, role) values ('${REVIEWER}', 'catalog_reviewer');
      insert into public.catalog_candidates (id, kind, title, publisher, subject, url, source_url, retrieved_on, agent_run_id, faith_content) values
        ('eeeeeeee-0000-0000-0000-000000000001', 'curriculum', 'Catechism', 'Test press', 'Religion', 'https://example.test/c', 'https://example.test/c', '2026-10-21', 'run', true),
        ('eeeeeeee-0000-0000-0000-000000000002', 'curriculum', 'Geometry', 'Test press', 'Math', 'https://example.test/g', 'https://example.test/g', '2026-10-21', 'run', false);`);
    asUser(REVIEWER, "select public.review_candidate('eeeeeeee-0000-0000-0000-000000000001', true), public.review_candidate('eeeeeeee-0000-0000-0000-000000000002', true);");

    await t.test("a school plan sees no faith content by default", () => {
      assert.equal(visible(SCHOOL[1]), "Geometry");
    });

    await t.test("a school contract that allows it sees all of it", () => {
      assert.equal(visible(ALLOWED[1]), "Catechism,Geometry");
    });

    await t.test("families and visitors see the whole reviewed catalog", () => {
      assert.equal(visible(FAMILY[1]), "Catechism,Geometry");
      assert.equal(psql("set role anon; select count(*) from public.curricula;").split("\n").at(-2), "2");
    });
  },
);
