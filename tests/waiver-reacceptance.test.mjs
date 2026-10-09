import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { loadModule, readStripped } from "./helpers.mjs";

/**
 * The waiver re-acceptance flow (spec art_ztdch8TP, "Governing text"): the
 * misuse clause ships as a version bump, and the version bump forces exactly
 * one re-acceptance per account — an acceptance under an older version stops
 * counting, the acceptance screen is shown at the next participation, and
 * accepting the current version ends the loop. Executed with the real
 * decision module and the real document; the query path is checked
 * structurally.
 */
const state = loadModule(new URL("../src/lib/exchange/waiver-state.ts", import.meta.url));

const source = readStripped(new URL("../src/lib/consent/waiver.ts", import.meta.url));
const current = source.match(/const VERSION = "([^"]+)"/)?.[1];
assert.ok(current, "the waiver declares a version");

test("an acceptance under an older version no longer counts", () => {
  assert.equal(
    state.waiverIsCurrent({ version: "2026-08-08.2", withdrawn_at: null }, current),
    false,
  );
});

test("accepting the current version satisfies the check — and does not loop", () => {
  const row = { version: current, withdrawn_at: null };
  // The re-acceptance writes the current version; the next participation
  // reads the same row. Same call, same answer — no second ask.
  assert.equal(state.waiverIsCurrent(row, current), true);
  assert.equal(state.waiverIsCurrent(row, current), true);
});

test("a withdrawn or missing acceptance counts for nothing", () => {
  assert.equal(
    state.waiverIsCurrent({ version: current, withdrawn_at: "2026-10-01T00:00:00Z" }, current),
    false,
  );
  assert.equal(state.waiverIsCurrent(null, current), false);
});

test("a row with no recorded version counts for nothing", () => {
  assert.equal(state.waiverIsCurrent({ version: null, withdrawn_at: null }, current), false);
});

test("the version moved, and the misuse clause is in the published text", () => {
  assert.notEqual(current, "2026-08-08.2", "the version must actually bump");
  for (const word of [
    "cryptocurrency",
    "seed phrase",
    "Cash App",
    "Venmo",
    "Zelle",
    "session ended",
    "automated tools",
  ]) {
    assert.ok(source.includes(word), `the misuse clause must name ${word}`);
  }
  assert.ok(
    readFileSync(new URL("../src/lib/consent/waiver.ts", import.meta.url), "utf8").includes(
      "WAIVER_SHA256 = documentHash(WAIVER)",
    ),
    "the document hash is derived from the published text",
  );
});

test("the acceptance check is version-aware, and acceptance stores the current version", () => {
  const check = readStripped(new URL("../src/lib/exchange/waiver.ts", import.meta.url));
  assert.ok(check.includes("waiverIsCurrent("), "the check must go through the version-aware decision");
  assert.ok(check.includes("WAIVER.version"), "against the currently published version");
  assert.ok(check.includes('"version, withdrawn_at"'), "reading the row's version and withdrawal state");

  const actions = readStripped(
    new URL("../src/lib/exchange/waiver-actions.ts", import.meta.url),
  );
  assert.ok(actions.includes("version: WAIVER.version"), "acceptance stores the current version");
  assert.ok(actions.includes('onConflict: "account_id"'), "acceptance replaces the one stored row");
});
