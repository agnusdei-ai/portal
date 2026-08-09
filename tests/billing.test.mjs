import { test, describe } from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";

import { instrumentEstablishesParent } from "../src/lib/billing/instrument.ts";

/**
 * The consent ceremony's two testable-without-credentials halves: the rule that
 * decides whether an instrument establishes a parent, and the signature check
 * that decides whether a webhook is really from the processor.
 *
 * What is NOT covered here, and needs a Stripe test key: a real charge, the
 * refund issued on refusal, and the dispute that suspends a seat. Those are
 * `stripe listen` plus `stripe trigger`, and they are the remaining half of the
 * end-to-end verification.
 */

describe("the instrument rule (parental-consent.md §3)", () => {
  test("a prepaid card does not establish a parent", () => {
    const verdict = instrumentEstablishesParent("prepaid");
    assert.equal(verdict.ok, false);
    assert.match(verdict.reason, /prepaid/);
  });

  test("credit and debit are accepted", () => {
    assert.equal(instrumentEstablishesParent("credit").ok, true);
    assert.equal(instrumentEstablishesParent("debit").ok, true);
  });

  test("an unclassified card is accepted rather than rejecting real parents", () => {
    // §3 records youth-card detection as an open item. Refusing every card the
    // network declines to classify would reject legitimate parents to catch a
    // case we cannot detect either way.
    assert.equal(instrumentEstablishesParent("unknown").ok, true);
    assert.equal(instrumentEstablishesParent(null).ok, true);
    assert.equal(instrumentEstablishesParent(undefined).ok, true);
  });
});

describe("webhook signature verification", () => {
  const secret = "whsec_test_secret_for_signature_verification";
  const stripe = new Stripe("sk_test_placeholder", { apiVersion: "2025-02-24.acacia" });
  const payload = JSON.stringify({
    id: "evt_test",
    type: "checkout.session.completed",
    data: { object: { id: "cs_test", payment_status: "paid" } },
  });

  test("a correctly signed payload is accepted", () => {
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
    const event = stripe.webhooks.constructEvent(payload, header, secret);
    assert.equal(event.type, "checkout.session.completed");
  });

  test("a payload altered after signing is rejected", () => {
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
    const tampered = payload.replace('"paid"', '"unpaid"');
    assert.throws(
      () => stripe.webhooks.constructEvent(tampered, header, secret),
      /signature/i,
      "The raw body must be what was signed; parsing it first would break this.",
    );
  });

  test("a signature from the wrong secret is rejected", () => {
    const header = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: "whsec_a_different_secret",
    });
    assert.throws(() => stripe.webhooks.constructEvent(payload, header, secret), /signature/i);
  });

  test("an old signature is rejected within a tolerance", () => {
    const header = stripe.webhooks.generateTestHeaderString({
      payload,
      secret,
      timestamp: Math.floor(Date.now() / 1000) - 3600,
    });
    assert.throws(
      () => stripe.webhooks.constructEvent(payload, header, secret, 300),
      /timestamp|tolerance/i,
    );
  });
});
