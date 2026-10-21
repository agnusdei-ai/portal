import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { dbHarness } from "./helpers.mjs";

// The seat label is the only child-keyed datum the hosted zone keeps
// (DECISIONS.md). These pin what the schema itself refuses.

const DB = "seat_label_schema_test";
const ADULT_A = "11111111-1111-1111-1111-111111111111";
const ADULT_B = "22222222-2222-2222-2222-222222222222";

const { psql, admin, ready, bootstrap } = dbHarness(DB);

const open = (adult, label, extra = {}) => {
  const cols = { owner_user_id: `'${adult}'`, notice_version: "'v1'", notice_acknowledged_at: "now()", seat_label: `'${label}'`, ...extra };
  const names = Object.keys(cols).filter((k) => cols[k] !== null);
  return psql(
    `insert into consent.consent_records (${names.join(", ")}) values (${names.map((k) => cols[k]).join(", ")}) returning id;`,
  ).split("\n")[0];
};
const refused = (fn) => {
  try {
    fn();
    return null;
  } catch (err) {
    return String(err.stderr ?? err.message);
  }
};

test(
  "the consent record holds a seat label, never a name",
  { skip: ready() ? false : "no local postgres; set TEST_DATABASE_URL" },
  async (t) => {
    bootstrap();
    psql(
      `insert into auth.users (id, email) values ('${ADULT_A}', 'a@test.local'), ('${ADULT_B}', 'b@test.local');
       insert into consent.notice_versions (version, sha256) values ('v1', decode('00', 'hex'));`,
    );

    await t.test("the name column is gone", () => {
      assert.equal(
        psql(`select count(*) from information_schema.columns where table_schema = 'consent' and column_name = 'child_account_name';`).trim(),
        "0",
      );
    });

    await t.test("a well-formed label is accepted", () => {
      assert.match(open(ADULT_A, "lantern.k7q2"), /^[0-9a-f-]{36}$/);
    });

    await t.test("a bare word, free text, or look-alike code is refused", () => {
      for (const label of ["Cecilia", "cecilia", "Lantern.k7q2", "lantern.k7", "lantern.k7q2zzz", "lantern.ko12", "my kid.k7q2"]) {
        assert.match(refused(() => open(ADULT_B, label)) ?? "", /seat_label_format/, label);
      }
    });

    await t.test("the code is unique per adult, not across adults", () => {
      assert.match(refused(() => open(ADULT_A, "harbor.k7q2")) ?? "", /consent_records_seat_code_idx/);
      assert.match(open(ADULT_B, "lantern.k7q2"), /^[0-9a-f-]{36}$/);
    });

    await t.test("a rename overwrites, leaving no trail", () => {
      psql(`update consent.consent_records set seat_label = 'harbor.k7q2' where owner_user_id = '${ADULT_A}';`);
      assert.equal(psql(`select seat_label from consent.consent_records where owner_user_id = '${ADULT_A}';`).trim(), "harbor.k7q2");
      assert.equal(
        psql(`select count(*) from pg_trigger where tgrelid = 'consent.consent_records'::regclass and not tgisinternal;`).trim(),
        "0",
        "a trigger on the consent record could keep old labels",
      );
      assert.equal(
        psql(`select string_agg(table_schema || '.' || table_name, ',') from information_schema.columns where column_name = 'seat_label';`).trim(),
        "consent.consent_records",
        "the label lives in exactly one place",
      );
    });

    await t.test("the evidence still requires the adult, the notice, and the time", () => {
      assert.match(refused(() => open(ADULT_A, "meadow.p3x9", { owner_user_id: null })) ?? "", /owner_user_id/);
      assert.match(refused(() => open(ADULT_A, "meadow.p3x9", { notice_acknowledged_at: null })) ?? "", /notice_acknowledged_at/);
      assert.match(refused(() => open(ADULT_A, "meadow.p3x9", { notice_version: "'unpublished'" })) ?? "", /foreign key/);
      assert.match(refused(() => psql(`insert into consent.notice_versions (version) values ('v2');`)) ?? "", /sha256/);
    });

    t.after(() => admin(`drop database if exists ${DB} with (force)`));
  },
);

test(
  "the migration refuses to run over existing consent evidence",
  { skip: ready() ? false : "no local postgres; set TEST_DATABASE_URL" },
  (t) => {
    const LIVE = "seat_label_guard_test";
    const live = dbHarness(LIVE);
    const files = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
    const at = files.indexOf("0009_seat_label.sql");

    live.admin(`drop database if exists ${LIVE} with (force)`);
    live.admin(`create database ${LIVE}`);
    live.psql(readFileSync("tests/fixtures/auth-stub.sql", "utf8"));
    for (const file of files.slice(0, at)) live.psql(readFileSync(join("supabase/migrations", file), "utf8"));
    live.psql(
      `insert into auth.users (id, email) values ('${ADULT_A}', 'a@test.local');
       insert into consent.notice_versions (version, sha256) values ('v1', decode('00', 'hex'));
       insert into consent.consent_records (owner_user_id, notice_version, notice_acknowledged_at, child_account_name)
       values ('${ADULT_A}', 'v1', now(), 'Synthetic');`,
    );

    assert.match(
      refused(() => live.psql(readFileSync("supabase/migrations/0009_seat_label.sql", "utf8"))) ?? "",
      /needs an owner decision/,
    );
    assert.equal(live.psql("select child_account_name from consent.consent_records;").trim(), "Synthetic");

    t.after(() => live.admin(`drop database if exists ${LIVE} with (force)`));
  },
);
