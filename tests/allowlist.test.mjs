import test from "node:test";
import assert from "node:assert/strict";

import { dbHarness } from "./helpers.mjs";

// Amendment 1 §3: any new field on an Exchange object needs an entry in its
// table and a reviewer's approval. This list is that approval in checkable
// form. Read from the catalog, so a column added by any migration counts.
const ALLOWED = {
  accounts: "id owner_user_id state_code created_at",
  seats: "id account_id state licence_token_sha256 licence_issued_at issued_at revoked_at suspended_at suspension_reason",
  listings: "id category title body state_code region posted_by_account state expires_at created_at posted_as",
  listing_replies: "id listing_id from_account body created_at",
  listing_reports: "id listing_id reported_by reason resolved_at created_at",
  coop_listings:
    "id slug name state_code region description meeting_day enquiry_ref is_listed created_at meeting_area_lat meeting_area_lng meeting_area_radius_mi",
};

// Not allowed anywhere in the hosted schema, whatever the table.
const FORBIDDEN = /phone|address|street|postcode|zip|birth|dob|legal_name|first_name|last_name|photo|image|attachment|ssn|tax_id/;

const DB = "allowlist_test";
const { psql, admin, ready, bootstrap } = dbHarness(DB);

test(
  "Exchange objects hold only reviewed fields",
  { skip: ready() ? false : "no local postgres; set TEST_DATABASE_URL" },
  async (t) => {
    bootstrap();
    t.after(() => admin(`drop database if exists ${DB} with (force)`));

    const rows = psql(
      `select table_schema || '.' || table_name || '|' || column_name from information_schema.columns
        where table_schema in ('public', 'consent') and table_name not like '%\\_v';`,
    ).trim().split("\n").map((r) => r.split("|"));

    for (const [table, allowed] of Object.entries(ALLOWED)) {
      await t.test(table, () => {
        const actual = rows.filter(([tbl]) => tbl === `public.${table}`).map(([, col]) => col).sort();
        assert.deepEqual(actual, allowed.split(" ").sort(), "new field: add it to amendment 1 §3 and here, with review");
      });
    }

    await t.test("no column anywhere names a forbidden identity field", () => {
      const hits = rows.filter(([, col]) => FORBIDDEN.test(col)).map((r) => r.join("."));
      assert.deepEqual(hits, []);
    });
  },
);
