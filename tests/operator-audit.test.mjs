import test from "node:test";
import assert from "node:assert/strict";

import { dbHarness } from "./helpers.mjs";

const DB = "operator_audit_test";
const A = "aaaaaaaa-0000-0000-0000-000000000001";
const B = "aaaaaaaa-0000-0000-0000-000000000002";
const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";
const MOD = "33333333-3333-3333-3333-333333333333";
const REPORTED = "dddddddd-0000-0000-0000-000000000001";
const QUIET = "dddddddd-0000-0000-0000-000000000002";
const { psql, admin, ready, bootstrap } = dbHarness(DB);

const as = (sub, aal, sql) =>
  psql(`set role authenticated; set request.jwt.claims = '${JSON.stringify({ sub, role: "authenticated", aal })}';\n${sql}`)
    .split("\n").filter((l) => l !== "SET" && !/^(INSERT|UPDATE|DELETE) \d+/.test(l)).join("\n").trim();
const refused = (fn) => {
  try {
    fn();
    return null;
  } catch (err) {
    return String(err.stderr ?? err.message);
  }
};

test(
  "operator reads of reply text are justified, multi-factor, and recorded without content",
  { skip: ready() ? false : "no local postgres; set TEST_DATABASE_URL" },
  async (t) => {
    bootstrap();
    t.after(() => admin(`drop database if exists ${DB} with (force)`));
    psql(`
      insert into auth.users (id, email) values ('${USER_A}', 'a@test.local'), ('${USER_B}', 'b@test.local'), ('${MOD}', 'm@test.local');
      insert into public.accounts (id, owner_user_id) values ('${A}', '${USER_A}'), ('${B}', '${USER_B}');
      insert into public.account_participants (account_id, class) values ('${A}', 'parent'), ('${B}', 'parent');
      insert into public.communication_waivers (account_id, version, sha256) values ('${A}', 't', '\\x00'), ('${B}', 't', '\\x00');
      insert into public.user_roles (user_id, role) values ('${MOD}', 'moderator');
      insert into public.listings (id, category, title, body, state_code, region, posted_by_account, posted_as) values
        ('${REPORTED}', 'materials', 'Kit', 'Synthetic body.', 'TX', 'Austin', '${A}', 'parent'),
        ('${QUIET}', 'materials', 'Other kit', 'Synthetic body.', 'TX', 'Austin', '${A}', 'parent');
      insert into public.listing_replies (listing_id, from_account, body) values
        ('${REPORTED}', '${B}', 'Synthetic reply one.'), ('${QUIET}', '${B}', 'Synthetic reply two.');
      insert into public.listing_reports (listing_id, reason, reported_by) values ('${REPORTED}', 'test', '${B}');`);

    await t.test("a moderator in a multi-factor session reads a reported listing's replies", () => {
      assert.equal(as(MOD, "aal2", `select body from public.operator_read_replies('${REPORTED}');`), "Synthetic reply one.");
    });

    await t.test("an unreported listing needs a support ticket", () => {
      assert.match(refused(() => as(MOD, "aal2", `select * from public.operator_read_replies('${QUIET}');`)) ?? "", /report on this listing or a support ticket/);
      assert.equal(as(MOD, "aal2", `select body from public.operator_read_replies('${QUIET}', 'TICKET-1042');`), "Synthetic reply two.");
    });

    await t.test("no multi-factor session or no moderator role, no read", () => {
      assert.match(refused(() => as(MOD, "aal1", `select * from public.operator_read_replies('${REPORTED}');`)) ?? "", /multi-factor/);
      assert.match(refused(() => as(USER_A, "aal2", `select * from public.operator_read_replies('${REPORTED}');`)) ?? "", /multi-factor/);
    });

    await t.test("each read leaves one content-free audit row", () => {
      assert.equal(
        psql("select reason || ':' || coalesce(ticket_ref, '-') from public.operator_reads order by read_at;").trim(),
        "report:-\nsupport:TICKET-1042",
      );
      const columns = psql("select string_agg(column_name, ' ' order by ordinal_position) from information_schema.columns where table_name = 'operator_reads';").trim();
      assert.equal(columns, "id operator_user_id listing_id reason ticket_ref read_at");
    });

    await t.test("the log cannot be edited, even by a moderator", () => {
      assert.match(refused(() => as(MOD, "aal2", "delete from public.operator_reads;")) ?? "", /permission denied/);
      assert.match(refused(() => psql("set role service_role; update public.operator_reads set reason = 'report';")) ?? "", /permission denied/);
    });
  },
);
