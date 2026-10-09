import { readdirSync, readFileSync, statSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

import { readStripped, loadModule } from "./helpers.mjs";

/**
 * Sign-in and multi-factor authentication (spec art_ztdch8TP, "Sign-in and
 * multi-factor authentication").
 *
 * The decision modules are pure, so the tests execute the real code; the
 * wiring claims are structural, in the manner of schema-invariants.test.mjs —
 * a gate that exists but is never called protects no one.
 */

const aal = loadModule(new URL("../src/lib/auth/aal.ts", import.meta.url));
const routing = loadModule(new URL("../src/lib/auth/callback.ts", import.meta.url));

// ===========================================================================
// The assurance gate, executed.
// ===========================================================================

test("a session with no enrolled factor is allowed everywhere", () => {
  assert.equal(aal.challengeRequired({ enrolled: false, currentLevel: "aal1" }), false);
  assert.equal(aal.challengeRequired({ enrolled: false, currentLevel: "aal2" }), false);
  assert.equal(aal.challengeRequired({ enrolled: false, currentLevel: null }), false);
});

test("an enrolled factor plus an AAL1 session is blocked", () => {
  assert.equal(aal.challengeRequired({ enrolled: true, currentLevel: "aal1" }), true);
});

test("an enrolled factor plus an AAL2 session is allowed", () => {
  assert.equal(aal.challengeRequired({ enrolled: true, currentLevel: "aal2" }), false);
});

test("an unknown level blocks a session with an enrolled factor", () => {
  assert.equal(aal.challengeRequired({ enrolled: true, currentLevel: null }), true);
});

function fakeClient({ currentLevel, factors, error }) {
  const calls = { listFactors: 0, assurance: 0 };
  return {
    calls,
    auth: {
      mfa: {
        getAuthenticatorAssuranceLevel: async () => {
          calls.assurance += 1;
          return { data: { currentLevel } };
        },
        listFactors: async () => {
          calls.listFactors += 1;
          if (error) return { data: null, error };
          return { data: { all: factors } };
        },
      },
    },
  };
}

test("mfaSessionState reads enrollment only for sessions below AAL2", async () => {
  const client = fakeClient({ currentLevel: "aal2", factors: [] });
  assert.deepEqual(await aal.mfaSessionState(client), { enrolled: true, currentLevel: "aal2" });
  // AAL2 implies a verified factor; asking the vendor to list factors for
  // every such session would be a network call on the hot path for nothing.
  assert.equal(client.calls.listFactors, 0, "AAL2 must short-circuit the factor listing.");
});

test("mfaSessionState sees a verified TOTP factor at AAL1", async () => {
  const client = fakeClient({
    currentLevel: "aal1",
    factors: [
      { factor_type: "totp", status: "verified" },
      { factor_type: "totp", status: "unverified" },
    ],
  });
  assert.deepEqual(await aal.mfaSessionState(client), { enrolled: true, currentLevel: "aal1" });
});

test("an unverified factor is not an enrolled one", async () => {
  const client = fakeClient({
    currentLevel: "aal1",
    factors: [{ factor_type: "totp", status: "unverified" }],
  });
  assert.deepEqual(await aal.mfaSessionState(client), { enrolled: false, currentLevel: "aal1" });
});

test("a verified non-TOTP factor does not satisfy the TOTP gate", async () => {
  const client = fakeClient({
    currentLevel: "aal1",
    factors: [{ factor_type: "phone", status: "verified" }],
  });
  assert.deepEqual(await aal.mfaSessionState(client), { enrolled: false, currentLevel: "aal1" });
});

test("without a session, nobody is enrolled and nothing is challenged", async () => {
  const client = fakeClient({ currentLevel: null, error: new Error("no session") });
  assert.deepEqual(await aal.mfaSessionState(client), { enrolled: false, currentLevel: null });
});

test("only the entry pages of participation writes are middleware-gated", () => {
  assert.equal(aal.isExchangeWriteEntry("/exchange/new"), true);
  assert.equal(aal.isExchangeWriteEntry("/exchange/waiver"), true);
  // Reading the exchange stays open at AAL1; the reply action itself is the
  // enforcement point there.
  assert.equal(aal.isExchangeWriteEntry("/exchange"), false);
  assert.equal(aal.isExchangeWriteEntry("/exchange/abc"), false);
  assert.equal(aal.isExchangeWriteEntry("/portal"), false);
});

// ===========================================================================
// Callback routing, executed.
// ===========================================================================

test("safeNext honors only in-app paths", () => {
  assert.equal(routing.safeNext("/exchange/new"), "/exchange/new");
  assert.equal(routing.safeNext("/portal"), "/portal");
  assert.equal(routing.safeNext(null), "/portal");
  assert.equal(routing.safeNext(undefined), "/portal");
  assert.equal(routing.safeNext(""), "/portal");
  assert.equal(routing.safeNext("https://evil.example"), "/portal");
  assert.equal(routing.safeNext("//evil.example"), "/portal");
  assert.equal(routing.safeNext("javascript:alert(1)"), "/portal");
});

test("callback routing sends the outcomes where they belong", () => {
  assert.equal(
    routing.callbackTarget({ sessionEstablished: false, challengeRequired: false, next: "/portal" }),
    "/login?error=link_expired",
  );
  assert.equal(
    routing.callbackTarget({ sessionEstablished: true, challengeRequired: true, next: "/exchange/new" }),
    `/auth/mfa?next=${encodeURIComponent("/exchange/new")}`,
  );
  assert.equal(
    routing.callbackTarget({ sessionEstablished: true, challengeRequired: false, next: "/portal" }),
    "/portal",
  );
});

// ===========================================================================
// Wiring, structurally.
// ===========================================================================

const login = readStripped(new URL("../src/app/login/page.tsx", import.meta.url));

test("the sign-in page offers Google, Microsoft (azure) and GitHub", () => {
  for (const provider of ['"google"', '"azure"', '"github"']) {
    assert.ok(login.includes(provider), `The sign-in page must offer ${provider}.`);
  }
  assert.ok(
    login.includes("signInWithOAuth") && login.includes("auth/callback?next="),
    "Provider sign-ins must return to the callback route with the next parameter.",
  );
});

test("the callback route wires the routing decision and the gate", () => {
  const route = readStripped(new URL("../src/app/auth/callback/route.ts", import.meta.url));
  for (const call of ["exchangeCodeForSession", "safeNext(", "callbackTarget(", "mfaSessionState("]) {
    assert.ok(route.includes(call), `The callback route must use ${call}.`);
  }
});

test("no sign-in path creates an account", () => {
  // The spec's unchanged invariant: OAuth links an identity; the §3 charge
  // webhook is the only writer that mints an accounts row. Structural, so a
  // stray insert cannot arrive quietly with an OAuth button.
  const writers = [];
  const srcRoot = new URL("../src", import.meta.url).pathname;
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const path = `${dir}/${entry}`;
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.tsx?$/.test(path)) writers.push(path);
    }
  };
  walk(srcRoot);

  const accountWriters = writers
    .filter((abs) => {
      const source = readStripped(abs);
      return /\.from\("accounts"\)\s*\.\s*(insert|upsert)/.test(source.replace(/\n\s*/g, ""));
    })
    .map((abs) => abs.slice(srcRoot.length + 1));
  assert.deepEqual(
    accountWriters,
    ["app/api/webhooks/stripe/route.ts"],
    "Only the Stripe webhook may create an account. An account ahead of the §3 charge would break the consent instrument.",
  );
});

// The enrollment and challenge surfaces, structurally. The MFA API is
// vendor-locked in Supabase's client, so what matters here is that the
// enrollment rides the standard otpauth:// secret — the reason one QR code
// serves Google, Microsoft, and Yubico authenticators.

const enroll = readStripped(new URL("../src/components/auth/TotpEnroll.tsx", import.meta.url));

test("enrollment enrolls TOTP and renders the standard otpauth secret", () => {
  assert.ok(enroll.includes('enroll({ factorType: "totp" })'), "Enrollment must request a TOTP factor.");
  assert.ok(enroll.includes("data.totp.uri"), "The QR must encode the standard otpauth:// URI.");
  assert.ok(enroll.includes("data.totp.secret"), "A manual-entry secret must accompany the QR.");
  for (const call of ["mfa.challenge(", "mfa.verify("]) {
    assert.ok(enroll.includes(call), `Enrollment must confirm through ${call}.`);
  }
  // Supabase never sees the rendered QR; it is drawn in the browser from the
  // enrollment response.
  assert.ok(enroll.includes("QRCode.toDataURL"), "The QR must be rendered locally.");
});

test("the challenge page verifies a code and promotes to AAL2 by navigation", () => {
  const page = readStripped(new URL("../src/app/auth/mfa/page.tsx", import.meta.url));
  for (const call of ["getAuthenticatorAssuranceLevel", "mfa.listFactors", "mfa.challenge(", "mfa.verify("]) {
    assert.ok(page.includes(call), `The challenge page must use ${call}.`);
  }
});

test("settings hosts the enrollment card and the portal links to it", () => {
  const settings = readStripped(new URL("../src/app/portal/settings/page.tsx", import.meta.url));
  assert.ok(settings.includes("<TotpEnroll"), "Settings must host the enrollment card.");
  const portal = readStripped(new URL("../src/app/portal/page.tsx", import.meta.url));
  assert.ok(portal.includes('"/portal/settings"'), "The portal home must link to settings.");
});

