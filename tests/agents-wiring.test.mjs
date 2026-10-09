import { readdirSync, readFileSync, statSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

import { readStripped } from "./helpers.mjs";

/**
 * The agent interface's wiring claims, structurally (spec art_ztdch8TP,
 * tutor persona row). The behavioral half is executed in agents-principal and
 * agents-discovery; what structure must guarantee is that the gates are
 * actually in the path and that the surface holds no privilege of its own —
 * a gate nobody calls protects no one.
 */

const route = readStripped(new URL("../src/app/api/agents/tutors/route.ts", import.meta.url));
const principal = readStripped(new URL("../src/lib/agents/principal.ts", import.meta.url));
const discovery = readStripped(new URL("../src/lib/agents/discovery.ts", import.meta.url));

function agentsSources() {
  const root = new URL("../src", import.meta.url).pathname;
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const path = `${dir}/${entry}`;
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.tsx?$/.test(path)) files.push(readStripped(path));
    }
  };
  walk(`${root}/lib/agents`);
  // The verification gate is part of this surface: its own-attestation read
  // is one of the reads the route composes.
  files.push(readStripped(new URL("../src/lib/verification/gate.ts", import.meta.url)));
  files.push(route);
  return files;
}

test("the route wires the composed gate, not a parallel one", () => {
  for (const call of ["agentPrincipal(", "mfaSessionState(", "attestationState("]) {
    assert.ok(route.includes(call), `The route must decide through ${call}.`);
  }
  // The gate composes the shipped decisions; it must not re-implement them.
  assert.ok(
    principal.includes("challengeRequired(") && principal.includes("verificationGate("),
    "The principal gate must compose the shipped AAL2 and verification decisions.",
  );
});

test("refusals are typed codes with statuses, not redirects", () => {
  for (const refusal of ["unauthenticated", "assurance-required", "verification-required"]) {
    assert.ok(route.includes(`"${refusal}"`), `The route must map ${refusal} to a status.`);
  }
  assert.ok(
    !route.includes("redirect("),
    "A household system reads JSON; a redirect is a page-shaped answer.",
  );
});

test("the agent surface reads through the caller's session and holds no privilege", () => {
  const sources = agentsSources().join("\n");
  assert.ok(
    !sources.includes("createServiceClient"),
    "The agent API must never hold the service role — every read is the caller's own RLS view.",
  );
  assert.ok(route.includes("createClient()"), "Reads run through the caller's own RLS session.");

  // Every table the surface touches, across route and libraries, is one whose
  // existing policies already permit the caller's reads. No new policy, no
  // migration, no view: the allowlist failing open means a new read surface
  // must be argued for here, not slipped in.
  const tables = new Set(
    [...sources.matchAll(/\.from\("(\w+)"\)/g)].map((m) => m[1]),
  );
  assert.deepEqual(
    [...tables].sort(),
    [
      "account_participants",
      "accounts",
      "coop_affiliations",
      "coop_listings",
      "permitted_axes",
      "verification_attestations",
    ].sort(),
  );
});

test("the agent surface writes nothing", () => {
  for (const source of agentsSources()) {
    assert.ok(
      !/\.(insert|update|upsert|delete)\(/.test(source),
      "Discovery is a read; a write here would be a second enforcement surface.",
    );
  }
});

test("column projections stay on the payload's allowlist", () => {
  // The account row contributes its id and nothing else; a widened select
  // must not quietly start carrying fields the payload never had.
  assert.ok(
    route.includes('.select("id").eq("owner_user_id"'),
    "The account read projects the id only — owner_user_id and the rest stay unread.",
  );
  assert.ok(
    route.includes('from("coop_affiliations")\n    .select("account_id, class, vouched_at, coop_listing_id")'),
    "The vouch read projects the allowlisted trust fields only.",
  );
  const sources = agentsSources().join("\n");
  assert.ok(!sources.includes('select("*"'), "No unprojected selects on the agent surface.");
});

test("the response is marked no-store", () => {
  assert.ok(
    route.includes('"Cache-Control": "no-store"'),
    "Trust data about other adults must not sit in shared caches.",
  );
});

test("the integrator guide exists and states the boundary", () => {
  const guide = readFileSync(new URL("../docs/agent-interface.md", import.meta.url), "utf8").toLowerCase();
  for (const required of [
    "/api/agents/tutors",
    "assurance-required",
    "verification-required",
    "household",
    "no identity pii",
  ]) {
    assert.ok(guide.includes(required), `The guide must state "${required}".`);
  }
});
