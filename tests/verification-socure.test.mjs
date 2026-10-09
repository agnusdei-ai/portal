import { test } from "node:test";
import assert from "node:assert/strict";

import { SocureError, startEvaluation } from "@/lib/verification/socure";

/**
 * The adapter runs against fixture responses behind the provider interface —
 * no live Socure tenant exists (the spec's sandbox reality check). The
 * redaction test at the bottom pins the privacy invariant: the intake path
 * emits no PII in log output, ever.
 */

const CONFIG = { baseUrl: "https://vendor.test", apiKey: "test-key" };

const INTAKE = {
  residency: "us",
  firstName: "Ada",
  lastName: "Lovelace",
  dob: "1985-04-12",
  email: "ada@example.com",
  phone: "5550100",
  address: {
    line1: "12 Analytical Way",
    city: "Portland",
    state: "OR",
    postalCode: "97201",
    country: "US",
  },
  documentTypes: ["drivers_license", "passport"],
};

/** Fixture responses, one per vendor decision. */
const FIXTURES = {
  accept: {
    requestId: "ev_100",
    decision: "accept",
    reasonCodes: ["I601"],
    docv: { transactionToken: "tok_abc123" },
  },
  resubmit: { requestId: "ev_101", decision: "resubmit", reasonCodes: ["R009"] },
  refer: { requestId: "ev_102", decision: "refer", reasonCodes: ["R101"] },
  review: { requestId: "ev_103", decision: "review", reasonCodes: [] },
  reject: { requestId: "ev_104", decision: "reject", reasonCodes: ["R204"] },
};

function vendorWith(body, status = 200) {
  const captured = { url: null, headers: null, body: null };
  const impl = async (url, init) => {
    captured.url = url;
    captured.headers = init.headers;
    captured.body = init.body;
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  };
  return { captured, impl };
}

test("each vendor decision normalizes to its portal state", async () => {
  const cases = [
    ["accept", "pending", "tok_abc123"],
    ["resubmit", "retry_required", null],
    ["refer", "manual_review", null],
    ["review", "manual_review", null],
    ["reject", "declined", null],
  ];

  for (const [decision, state, token] of cases) {
    const vendor = vendorWith(FIXTURES[decision]);
    const start = await startEvaluation(INTAKE, {
      config: CONFIG,
      fetch: vendor.impl,
    });

    assert.equal(start.state, state, `decision ${decision}`);
    assert.equal(start.vendorEvaluationId, FIXTURES[decision].requestId);
    assert.equal(start.docvTransactionToken, token);
    assert.deepEqual(start.reasonCodes, FIXTURES[decision].reasonCodes);
  }
});

test("the intake reaches the vendor and nowhere else", async () => {
  const vendor = vendorWith(FIXTURES.accept);
  await startEvaluation(INTAKE, { config: CONFIG, fetch: vendor.impl });

  // It transits: the wire body carries the PII to the configured base URL.
  assert.ok(vendor.captured.url.startsWith("https://vendor.test/"));
  const sent = JSON.parse(vendor.captured.body);
  assert.equal(sent.firstName, "Ada");
  assert.equal(sent.dob, "1985-04-12");
  assert.equal(sent.email, "ada@example.com");
  assert.deepEqual(sent.documentTypes, ["drivers_license", "passport"]);

  // It is authorized as a server-to-server call.
  assert.equal(vendor.captured.headers["Authorization"], "Bearer test-key");
});

test("a response outside the fixture contract fails loudly", async () => {
  for (const body of [
    { decision: "accept" }, // no evaluation reference
    { requestId: "ev_x", decision: "maybe" }, // decision outside the union
    "not an object",
  ]) {
    const vendor = vendorWith(body);
    await assert.rejects(
      startEvaluation(INTAKE, { config: CONFIG, fetch: vendor.impl }),
      SocureError,
    );
  }
});

test("a vendor outage raises a SocureError", async () => {
  const vendor = vendorWith({ requestId: "ev_x", decision: "accept" }, 503);
  await assert.rejects(
    startEvaluation(INTAKE, { config: CONFIG, fetch: vendor.impl }),
    SocureError,
  );

  const unreachable = async () => {
    throw new TypeError("fetch failed");
  };
  await assert.rejects(
    startEvaluation(INTAKE, { config: CONFIG, fetch: unreachable }),
    SocureError,
  );
});

test("the intake path emits no PII in log output", async () => {
  const methods = ["log", "info", "warn", "error", "debug", "trace"];
  const originals = Object.fromEntries(methods.map((m) => [m, console[m]]));
  const calls = [];
  for (const m of methods) {
    console[m] = (...args) => calls.push({ method: m, args });
  }

  try {
    for (const fixture of Object.values(FIXTURES)) {
      const vendor = vendorWith(fixture);
      await startEvaluation(INTAKE, { config: CONFIG, fetch: vendor.impl });
    }
    // And through the failure path, where a naive handler might log the body.
    const failing = vendorWith({ decision: "accept" });
    await startEvaluation(INTAKE, { config: CONFIG, fetch: failing.impl }).catch(
      () => {},
    );
  } finally {
    for (const [m, original] of Object.entries(originals)) console[m] = original;
  }

  // Nothing was logged at all, so nothing PII could have been logged.
  assert.deepEqual(calls, [], `the intake path called a logger: ${JSON.stringify(calls)}`);
});
