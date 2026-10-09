/**
 * Structural guard on the exchange server actions' security composition.
 *
 * The exchange actions carry two gates composed with account resolution:
 * requireAal2() (MFA assurance, PR #6) → currentAccountId() (the shared
 * account resolver) → requireVerifiedAccount(accountId) (verified-adult
 * gate, PR #7). A refactor that silently drops any of these must fail
 * here rather than merge quietly. New exported actions must be classified
 * below — the enumeration assertion forces that decision to be conscious.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(HERE, "..", "src", "lib", "exchange", "actions.ts");

/** Every exported async server action in the module, in source order. */
function exportedActions(source) {
  return [...source.matchAll(/export async function (\w+)\(/g)].map((m) => m[1]);
}

/** The body of one action: from its declaration to the next one (or EOF). */
function actionBody(source, name) {
  const start = source.indexOf(`export async function ${name}(`);
  if (start === -1) return null;
  const rest = source.slice(start + 1);
  const next = rest.search(/export async function \w+\(/);
  return next === -1 ? rest : rest.slice(0, next);
}

test("every exported exchange action is classified in this guard", () => {
  const source = readFileSync(SOURCE, "utf8");
  assert.deepEqual(
    exportedActions(source),
    ["createListing", "replyToListing", "reportListing"],
    "A new exchange action was added without classifying its gates in tests/exchange-gates.test.mjs — participation actions need requireAal2 + requireVerifiedAccount; report-style intake needs attribution.",
  );
});

test("participation actions carry AAL2, account resolution, and the verified-adult gate, in order", () => {
  const source = readFileSync(SOURCE, "utf8");
  for (const name of ["createListing", "replyToListing"]) {
    const body = actionBody(source, name);
    assert.ok(body, `${name} vanished from ${SOURCE}`);
    const aal2 = body.indexOf("requireAal2()");
    const resolved = body.indexOf("currentAccountId()");
    const verified = body.indexOf("requireVerifiedAccount(accountId)");
    assert.ok(aal2 !== -1, `${name} no longer requires an AAL2 session`);
    assert.ok(resolved !== -1, `${name} no longer resolves the account through currentAccountId`);
    assert.ok(verified !== -1, `${name} no longer requires a verified adult`);
    assert.ok(
      aal2 < resolved && resolved < verified,
      `${name}'s gates are out of order: AAL2 must precede account resolution, which must precede the verified-adult gate`,
    );
  }
});

test("report intake attributes the reporting account", () => {
  const body = actionBody(readFileSync(SOURCE, "utf8"), "reportListing");
  assert.ok(body, "reportListing vanished from the exchange actions");
  assert.ok(
    body.includes("currentAccountId()"),
    "reportListing must attribute its reports to the caller's account",
  );
});
