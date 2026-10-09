import { test } from "node:test";
import assert from "node:assert/strict";

import { createHmac } from "node:crypto";

import {
  buildUpdate,
  buildWrite,
  parseWebhookEvent,
  verifyWebhookSignature,
} from "@/lib/verification/webhook";

const SECRET = "whsec_test_0123456789";

function sign(body, timestamp, secret = SECRET) {
  return `t=${timestamp}, v1=${createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex")}`;
}

const BODY = JSON.stringify({
  event: "evaluation_completed",
  data: {
    referenceId: "eval-1001",
    outcome: "accept",
    documentType: "drivers_license",
    docvTransactionId: "docv-777",
    reasonCodes: [],
  },
});

test("a correctly signed, fresh event verifies", () => {
  const now = Math.floor(Date.now() / 1000);
  assert.ok(
    verifyWebhookSignature({
      secret: SECRET,
      header: sign(BODY, now),
      rawBody: BODY,
      nowSeconds: now,
    }),
  );
});

test("a tampered body fails the signature", () => {
  const now = Math.floor(Date.now() / 1000);
  const header = sign(BODY, now);
  assert.ok(
    !verifyWebhookSignature({
      secret: SECRET,
      header,
      rawBody: BODY.replace("accept", "reject"),
      nowSeconds: now,
    }),
  );
});

test("a stale timestamp fails the signature", () => {
  const stale = Math.floor(Date.now() / 1000) - 60 * 60;
  assert.ok(
    !verifyWebhookSignature({
      secret: SECRET,
      header: sign(BODY, stale),
      rawBody: BODY,
      nowSeconds: stale + 60 * 60,
    }),
  );
});

test("a signed body verified with the wrong secret fails", () => {
  const now = Math.floor(Date.now() / 1000);
  assert.ok(
    !verifyWebhookSignature({
      secret: "whsec_other",
      header: sign(BODY, now),
      rawBody: BODY,
      nowSeconds: now,
    }),
  );
});

test("a missing or malformed header fails the signature", () => {
  const now = Math.floor(Date.now() / 1000);
  assert.ok(
    !verifyWebhookSignature({ secret: SECRET, header: null, rawBody: BODY, nowSeconds: now }),
  );
  assert.ok(
    !verifyWebhookSignature({ secret: SECRET, header: "v1=deadbeef", rawBody: BODY, nowSeconds: now }),
  );
});

test("an evaluation_completed event parses to the normalized shape", () => {
  const event = parseWebhookEvent(JSON.parse(BODY));
  assert.ok(event);
  assert.equal(event.vendorEvaluationId, "eval-1001");
  assert.equal(event.outcome, "accept");
  assert.equal(event.documentType, "drivers_license");
  assert.equal(event.docvReferenceId, "docv-777");
});

test("an unknown event shape parses to null", () => {
  assert.equal(parseWebhookEvent({ event: "ping" }), null);
  assert.equal(parseWebhookEvent({ event: "evaluation_completed", data: {} }), null);
  assert.equal(parseWebhookEvent("not an object"), null);
});

test("an unparseable outcome builds no write", () => {
  const event = parseWebhookEvent({
    event: "evaluation_completed",
    data: { referenceId: "eval-1002", outcome: "who-knows" },
  });
  assert.ok(event);
  assert.equal(buildWrite(event), null);
});

/**
 * The replay-safety simulation: a tiny in-memory attestation updated the way
 * the route updates Postgres — patch applied only when the row's state is in
 * guardStates. A redelivered event must leave the row (and verified_at)
 * exactly as the first delivery left it.
 */
function simulateDeliver(row, payload) {
  const event = parseWebhookEvent(payload);
  const write = event ? buildWrite(event) : null;
  if (!write) return false;
  const { patch, guardStates } = buildUpdate(write);
  if (!guardStates.includes(row.state)) return false;
  for (const [key, value] of Object.entries(patch)) {
    row[key] = value;
  }
  return true;
}

const ACCEPTED_EVENT = {
  event: "evaluation_completed",
  data: {
    referenceId: "eval-2001",
    outcome: "accept",
    documentType: "passport",
    docvTransactionId: "docv-888",
    reasonCodes: [],
  },
};

test("a replayed verified event does not write twice", () => {
  const row = {
    state: "pending",
    document_type: null,
    docv_reference_id: null,
    verified_at: null,
    reason_codes: [],
  };
  assert.ok(simulateDeliver(row, ACCEPTED_EVENT));
  const first = { ...row };
  assert.ok(!simulateDeliver(row, ACCEPTED_EVENT));
  assert.deepEqual(row, first);
  assert.equal(row.state, "verified");
  assert.ok(row.verified_at);
});

test("a retry event keeps the attestation in flight and a later accept lands", () => {
  const row = {
    state: "pending",
    document_type: null,
    docv_reference_id: null,
    verified_at: null,
    reason_codes: [],
  };
  assert.ok(
    simulateDeliver(row, {
      event: "evaluation_completed",
      data: { referenceId: "eval-2001", outcome: "resubmit", reasonCodes: ["R999"] },
    }),
  );
  assert.equal(row.state, "retry_required");
  assert.equal(row.verified_at, null);
  assert.ok(simulateDeliver(row, ACCEPTED_EVENT));
  assert.equal(row.state, "verified");
  assert.ok(row.verified_at);
});

test("a declined event lands and a later replay cannot revive it", () => {
  const row = {
    state: "pending",
    document_type: null,
    docv_reference_id: null,
    verified_at: null,
    reason_codes: [],
  };
  assert.ok(
    simulateDeliver(row, {
      event: "evaluation_completed",
      data: { referenceId: "eval-2001", outcome: "reject", reasonCodes: ["R001"] },
    }),
  );
  assert.equal(row.state, "declined");
  assert.ok(!simulateDeliver(row, ACCEPTED_EVENT));
  assert.equal(row.state, "declined");
});

test("the verified patch sets verified_at and omits null document fields", () => {
  const write = buildWrite({
    vendorEvaluationId: "eval-2001",
    docvReferenceId: null,
    documentType: null,
    outcome: "accept",
    reasonCodes: [],
  });
  assert.ok(write);
  const { patch, guardStates } = buildUpdate(write);
  assert.ok(patch.verified_at);
  assert.equal(patch.document_type, undefined);
  assert.equal(patch.docv_reference_id, undefined);
  assert.deepEqual(guardStates, ["pending", "retry_required", "manual_review"]);
});
