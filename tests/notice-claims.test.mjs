import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Amendment 1 §4.2: say plainly that Exchange replies are operator-readable
// and not end-to-end encrypted; never call the Exchange private or secure.

const SURFACES = [
  "src/lib/consent/waiver.ts",
  "src/app/(public)/exchange",
  "src/app/portal/inbox",
  "src/components/exchange",
  "src/components/inbox",
];

const files = (path) =>
  statSync(path).isDirectory()
    ? readdirSync(path).flatMap((n) => files(join(path, n)))
    : /\.tsx?$/.test(path) ? [path] : [];

const text = (path) => readFileSync(path, "utf8").replace(/\s+/g, " ");

test("the waiver, listing page, and inbox say replies are readable and not encrypted", () => {
  for (const page of ["src/lib/consent/waiver.ts", "src/app/(public)/exchange/[id]/page.tsx", "src/app/portal/inbox/page.tsx"]) {
    const t = text(page);
    assert.match(t, /not end-to-end encrypted/i, page);
    assert.match(t, /(we|Agnus Dei) can read/i, page);
  }
});

test("no Exchange copy calls its messages private, secure, or encrypted", () => {
  // The required negation is removed first, so any end-to-end claim left is a claim.
  const claim = /\b(private|secure|encrypted|confidential)\s+(messag\w*|conversations?|repl(y|ies)|inbox|chat)\b|end-to-end encrypted/i;
  const offences = SURFACES.flatMap(files).filter((f) => claim.test(text(f).replace(/not end-to-end encrypted/gi, "")));
  assert.deepEqual(offences, []);
});
