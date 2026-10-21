import test from "node:test";
import assert from "node:assert/strict";

import { loadModule, readStripped } from "./helpers.mjs";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.example";
process.env.NEXT_PUBLIC_SOCURE_DOCV_SDK_URL = "https://sdk.socure.example/docv.js";
const { contentSecurityPolicy, originAllowed } = await loadModule(new URL("../src/lib/security/headers.ts", import.meta.url));
const { default: config } = await loadModule(new URL("../next.config.ts", import.meta.url));

const directives = (csp) => Object.fromEntries(csp.split("; ").map((d) => [d.split(" ")[0], d.split(" ").slice(1)]));

test("scripts run only with the request nonce, and nothing frames the site", () => {
  const csp = directives(contentSecurityPolicy("abc123", false));
  assert.deepEqual(csp["script-src"], ["'self'", "'nonce-abc123'", "'strict-dynamic'"]);
  assert.deepEqual(csp["object-src"], ["'none'"]);
  assert.deepEqual(csp["frame-ancestors"], ["'none'"]);
  assert.deepEqual(csp["base-uri"], ["'self'"]);
  assert.ok(csp["connect-src"].includes("wss://project.supabase.example"));
  assert.deepEqual(csp["frame-src"], ["https://sdk.socure.example"]);
});

test("eval is allowed only in development", () => {
  assert.ok(!contentSecurityPolicy("n", false).includes("unsafe-eval"));
  assert.ok(contentSecurityPolicy("n", true).includes("'unsafe-eval'"));
});

test("state-changing requests must come from the site; webhooks are exempt", () => {
  const site = "https://portal.example";
  assert.equal(originAllowed("POST", "/exchange/new", site, site), true);
  assert.equal(originAllowed("POST", "/exchange/new", "https://evil.example", site), false);
  assert.equal(originAllowed("POST", "/exchange/new", null, site), false);
  assert.equal(originAllowed("DELETE", "/api/agents/tutors", "https://evil.example", site), false);
  assert.equal(originAllowed("GET", "/exchange", "https://evil.example", site), true);
  assert.equal(originAllowed("POST", "/api/webhooks/stripe", null, site), true);
});

test("fixed headers apply to every route", async () => {
  const [rule] = await config.headers();
  assert.equal(rule.source, "/(.*)");
  const byKey = Object.fromEntries(rule.headers.map((h) => [h.key, h.value]));
  assert.match(byKey["Strict-Transport-Security"], /max-age=\d{8}/);
  assert.equal(byKey["X-Content-Type-Options"], "nosniff");
  assert.equal(byKey["X-Frame-Options"], "DENY");
  assert.match(byKey["Permissions-Policy"], /microphone=\(\)/);
  assert.equal(config.poweredByHeader, false);
});

test("the middleware applies both rules", () => {
  const mw = readStripped("src/middleware.ts");
  assert.match(mw, /originAllowed\(/);
  assert.match(mw, /request\.headers\.set\("Content-Security-Policy"/);
  assert.match(mw, /response\.headers\.set\("Content-Security-Policy"/);
});
