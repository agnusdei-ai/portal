import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { readStripped } from "./helpers.mjs";

// Agents never read seat labels or reply bodies (DECISIONS.md, amendment 1
// §4.5). Every JSON route an agent can call is followed through its whole
// import closure, because direct Postgres to the consent schema would bypass
// any table allowlist. Webhooks answer the processor and identity vendor
// only, so they are not agent-readable.

function routes(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "webhooks" ? [] : routes(path);
    return name === "route.ts" ? [path] : [];
  });
}

function resolve(spec) {
  const base = join("src", spec.slice(2));
  return [".ts", ".tsx", "/index.ts"].map((ext) => base + ext).find(existsSync) ?? (existsSync(base) ? base : null);
}

function closure(entry) {
  const seen = new Map();
  const visit = (file) => {
    if (seen.has(file)) return;
    const text = readStripped(file);
    seen.set(file, text);
    // Type-only imports erase at build and carry no data.
    for (const m of text.matchAll(/^(?!(?:import|export) type )[^\n]*from\s+"(@\/[^"]+)"/gm)) {
      const next = resolve(m[1]);
      if (next) visit(next);
    }
  };
  visit(entry);
  return seen;
}

const FORBIDDEN = [
  [/@\/lib\/db"|consentQuery|consent\./, "reaches the consent schema"],
  [/listing_replies/, "reads replies"],
  [/seat_?label/i, "touches seat labels"],
  [/\bbody\b/, "touches a listing or reply body"],
];

test("no agent-readable route can reach seat labels or reply bodies", () => {
  const offences = [];
  const entries = routes("src/app/api");
  assert.ok(entries.some((r) => r.includes("agents")), "the agent route was not found");
  for (const route of entries) {
    for (const [file, text] of closure(route)) {
      for (const [pattern, what] of FORBIDDEN) {
        if (pattern.test(text)) offences.push(`${route} -> ${file} ${what}`);
      }
    }
  }
  assert.deepEqual(offences, []);
});
