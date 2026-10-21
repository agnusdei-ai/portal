import test from "node:test";
import assert from "node:assert/strict";

import { dbHarness, loadModule } from "./helpers.mjs";

const { seatWordWarning } = await loadModule(new URL("../src/lib/consent/seat-label.ts", import.meta.url));

test("words that could identify a child draw a warning", () => {
  for (const word of ["james", "Olivia", " emma ", "jk", "abc", "june", "september", "birthday", "oakschool", "academy"]) {
    assert.ok(seatWordWarning(word), word);
  }
});

test("ordinary words pass without a warning", () => {
  for (const word of ["lantern", "harbor", "meadow", "comet", "juniper", "maybe"]) {
    assert.equal(seatWordWarning(word), null, word);
  }
});

const DB = "seat_label_generator_test";
const ADULT = "11111111-1111-1111-1111-111111111111";
const { psql, admin, ready, bootstrap } = dbHarness(DB);

test(
  "every generated code satisfies the schema and they differ",
  { skip: ready() ? false : "no local postgres; set TEST_DATABASE_URL" },
  (t) => {
    bootstrap();
    t.after(() => admin(`drop database if exists ${DB} with (force)`));
    psql(
      `insert into auth.users (id, email) values ('${ADULT}', 'a@test.local');
       insert into consent.notice_versions (version, sha256) values ('v1', decode('00', 'hex'));
       insert into consent.consent_records (owner_user_id, notice_version, notice_acknowledged_at, seat_label)
       select '${ADULT}', 'v1', now(), 'lantern.' || consent.seat_code() from generate_series(1, 50);`,
    );
    assert.equal(psql("select count(distinct seat_label) from consent.consent_records;").trim(), "50");
  },
);
