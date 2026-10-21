import test from "node:test";
import assert from "node:assert/strict";

import { dbHarness } from "./helpers.mjs";

const DB = "retention_test";
const A = "aaaaaaaa-0000-0000-0000-000000000001";
const B = "aaaaaaaa-0000-0000-0000-000000000002";
const LISTING = "dddddddd-0000-0000-0000-000000000001";
const { psql, admin, failure, ready, bootstrap } = dbHarness(DB);

test(
  "replies older than 12 months are deleted and the job reports only a count",
  { skip: ready() ? false : "no local postgres; set TEST_DATABASE_URL" },
  async (t) => {
    bootstrap();
    t.after(() => admin(`drop database if exists ${DB} with (force)`));
    psql(`
      insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'a@test.local'), ('22222222-2222-2222-2222-222222222222', 'b@test.local');
      insert into public.accounts (id, owner_user_id) values ('${A}', '11111111-1111-1111-1111-111111111111'), ('${B}', '22222222-2222-2222-2222-222222222222');
      insert into public.account_participants (account_id, class) values ('${A}', 'parent'), ('${B}', 'parent');
      insert into public.communication_waivers (account_id, version, sha256) values ('${A}', 't', '\\x00'), ('${B}', 't', '\\x00');
      insert into public.listings (id, category, title, body, state_code, region, posted_by_account, posted_as)
        values ('${LISTING}', 'materials', 'Kit', 'Synthetic body.', 'TX', 'Austin', '${A}', 'parent');
      insert into public.listing_replies (listing_id, from_account, body, created_at) values
        ('${LISTING}', '${B}', 'Synthetic old reply.', now() - interval '13 months'),
        ('${LISTING}', '${B}', 'Synthetic recent reply.', now() - interval '11 months');`);

    await t.test("the job deletes only expired replies and returns their count", () => {
      assert.equal(psql("select public.expire_replies();").trim(), "1");
      assert.equal(psql("select body from public.listing_replies;").trim(), "Synthetic recent reply.");
      assert.equal(psql("select public.expire_replies();").trim(), "0");
    });

    await t.test("no member can run it", () => {
      assert.match(failure("11111111-1111-1111-1111-111111111111", "select public.expire_replies();") ?? "", /permission denied/);
    });
  },
);
