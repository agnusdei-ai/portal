import { test } from "node:test";
import assert from "node:assert/strict";

import { loadModule } from "./helpers.mjs";

/**
 * The abuse record, executed (spec art_ztdch8TP, "Layer 3 — termination and
 * the record"). The module runs against a mocked Supabase admin client so the
 * row shape, the account scoping, and the error handling are pinned rather
 * than assumed. No network is touched, no credential is needed, and nothing
 * resembling a request body or an IP address ever appears in a row.
 */
const events = loadModule(new URL("../src/lib/abuse/events.ts", import.meta.url));

function fakeAdmin() {
  const calls = { signOut: [], inserts: [] };
  return {
    calls,
    auth: {
      admin: {
        signOut: async (sessionId) => {
          calls.signOut.push(sessionId);
          return { error: null };
        },
      },
    },
    from: (table) => ({
      insert: async (row) => {
        calls.inserts.push({ table, row });
        return { error: null };
      },
    }),
  };
}

test("a blocked submission records kind, action, and account — nothing else", async () => {
  const admin = fakeAdmin();
  const errors = await events.recordAbuseEvent(admin, {
    accountId: "acc-9",
    kind: "crypto_solicitation",
    action: "blocked",
  });

  assert.deepEqual(errors, []);
  assert.deepEqual(admin.calls.inserts, [
    {
      table: "abuse_events",
      row: {
        account_id: "acc-9",
        kind: "crypto_solicitation",
        action: "blocked",
        detail: {},
      },
    },
  ]);
  assert.deepEqual(admin.calls.signOut, [], "a blocked action revokes nothing.");
});

test("an anonymous refusal is recorded with a null account", async () => {
  const admin = fakeAdmin();
  await events.recordAbuseEvent(admin, {
    accountId: null,
    kind: "rate_limit",
    action: "blocked",
  });
  assert.deepEqual(admin.calls.inserts[0].row.account_id, null);
});

test("an insert failure comes back as a string, not swallowed", async () => {
  const admin = fakeAdmin();
  admin.from = () => ({
    insert: async () => ({ error: { message: "permission denied" } }),
  });
  const errors = await events.recordAbuseEvent(admin, {
    accountId: "acc-9",
    kind: "rate_limit",
    action: "blocked",
  });
  assert.equal(errors.length, 1);
  assert.ok(errors[0].includes("permission denied"));
});
