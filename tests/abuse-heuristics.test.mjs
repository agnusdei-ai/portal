import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { readStripped } from "./helpers.mjs";

/**
 * The crypto and off-platform-payment heuristics (spec art_ztdch8TP,
 * "Layer 1 — content heuristics, at submission").
 *
 * The patterns are read out of src/lib/exchange/schema.ts the way
 * exchange-content.test.mjs reads the contact rules, so this corpus runs
 * against the regexes that ship rather than against a copy of them. The
 * corpus is the tuning bar named in the spec: positives are the shapes and
 * phrasings that must be refused, negatives are ordinary curriculum language
 * that must keep passing.
 */
const source = readFileSync(
  new URL("../src/lib/exchange/schema.ts", import.meta.url),
  "utf8",
);

function cryptoPatterns() {
  const start = source.indexOf("const CRYPTO_SOLICITATION");
  assert.ok(start !== -1, "CRYPTO_SOLICITATION must exist in the exchange schema");
  const block = source.slice(start, source.indexOf("];", start));
  assert.ok(block.length > 0, "the crypto pattern list must not be empty");
  return [...block.matchAll(/\/((?:[^/\\\n]|\\.)+)\/([gimsuy]*)/g)].map(
    ([, body, flags]) => new RegExp(body, flags),
  );
}

function flagged(text) {
  return cryptoPatterns().some((r) => r.test(text));
}

const positives = [
  // Address shapes.
  "Pay with bitcoin: 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
  "co-op fund goes to bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
  "ETH welcome — 0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
  "Litecoin LfWZDbnmhgcJm8kT7zocXjvmYSDjb6thAG accepted",
  "ltc1q8dvmqy3j0m6de3jn0h5y8hpp3wr0g4j0cws6u8",
  "send USDT to my wallet and I will ship the set",
  // Phrasings.
  "crypto payment only, sorry",
  "Got a crypto wallet? Send the funds there.",
  "accepting ethereum for the microscope",
  "I will need your seed phrase to hand over the licence",
  "wallet address on request",
  "keystore file available for the buyer",
  // Off-platform payment steering.
  "venmo me for the gas money",
  "Cash App only, no exceptions",
  "zelle the deposit before pickup",
  "paypal.me/coopfund",
  "PayPal works too",
];

const negatives = [
  // The spec's canonical negative: crypto- words are not crypto.
  "Cryptozoology unit study — dinosaurs, sea monsters, and the scientific method.",
  "We finished our cryptography unit; the kids loved the cryptograms.",
  "The nature co-op will send a newsletter about the bitcoin mining talk.",
  // Ordinary listings.
  "Saxon Math 7/6, second edition. $25 or best offer; the binding is sound.",
  "Sewing co-op: we made a leather wallet in handicrafts.",
  "Payment plans available for the full-year math curriculum.",
  "The botany co-op swaps seed packets every spring.",
  "Library card catalog and an address book for the geography unit.",
  "Tickets to the museum fair are a suggested donation.",
  "Cash at pickup is fine for the microscope.",
];

test("cryptocurrency dealing is caught in every shape the corpus names", () => {
  for (const text of positives) {
    assert.ok(flagged(text), `must be caught: ${text}`);
  }
});

test("ordinary curriculum language passes", () => {
  for (const text of negatives) {
    assert.ok(!flagged(text), `must not be caught: ${text}`);
  }
});

test("a cryptozoology unit study is not a cryptocurrency", () => {
  // Pinned separately because it is the false positive the spec names.
  assert.ok(!flagged("Cryptozoology unit study"));
});

test("the gate consumes the crypto list, and the refusal is classified for the record", () => {
  const gate = source.slice(
    source.indexOf("export function findProhibitedContent"),
    source.indexOf("const noProhibited"),
  );
  assert.ok(
    gate.includes("findCryptoSolicitation(text)"),
    "findProhibitedContent must run the crypto check.",
  );

  const actions = readStripped(
    new URL("../src/lib/exchange/actions.ts", import.meta.url),
  );
  assert.ok(
    actions.includes("findCryptoSolicitation("),
    "The actions must classify a refused submission as crypto when it is one.",
  );
  assert.ok(
    actions.includes('"crypto_solicitation"') && actions.includes("recordAbuseEvent("),
    "A crypto refusal must record an abuse event under the service role.",
  );
});
