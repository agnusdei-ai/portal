import { test, describe } from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";

import { instrumentEstablishesParent } from "../src/lib/billing/instrument.ts";

/**
 * The two halves of the consent ceremony testable without credentials: the
 * rule deciding whether an instrument establishes a parent, and the signature
 * check deciding whether a webhook is really the processor's. A real charge,
 * the refund on refusal, and the dispute that suspends a seat need a Stripe
 * test key (`stripe listen` + `stripe trigger`) and are not covered here.
 */
describe("the instrument rule (parental-consent.md §3)", () => {
  test("a prepaid card does not establish a parent", () => {
    const verdict = instrumentEstablishesParent("prepaid");
    assert.equal(verdict.ok, false);
    assert.match(verdict.reason, /prepaid/);
  });

  test("credit, debit, and unclassified cards are accepted", () => {
    for (const funding of ["credit", "debit", "unknown", null, undefined]) {
      assert.equal(instrumentEstablishesParent(funding).ok, true, String(funding));
    }
  });
});

describe("webhook signature verification", () => {
  const secret = "whsec_test_secret";
  const stripe = new Stripe("sk_test_placeholder");
  const payload = JSON.stringify({ id: "evt_test", type: "checkout.session.completed", data: { object: { payment_status: "paid" } } });

  test("a correctly signed payload is accepted", () => {
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
    assert.equal(stripe.webhooks.constructEvent(payload, header, secret).type, "checkout.session.completed");
  });

  test("a payload altered after signing is rejected", () => {
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
    assert.throws(() => stripe.webhooks.constructEvent(payload.replace('"paid"', '"unpaid"'), header, secret), /signature/i);
  });

  test("a signature from the wrong secret is rejected", () => {
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_other" });
    assert.throws(() => stripe.webhooks.constructEvent(payload, header, secret), /signature/i);
  });

  test("a stale signature is rejected within the tolerance", () => {
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret, timestamp: Math.floor(Date.now() / 1000) - 3600 });
    assert.throws(() => stripe.webhooks.constructEvent(payload, header, secret, 300), /timestamp|tolerance/i);
  });
});
