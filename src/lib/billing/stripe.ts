import "server-only";

import Stripe from "stripe";

let client: Stripe | null = null;

export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  client ??= new Stripe(key, { apiVersion: "2025-02-24.acacia" });
  return client;
}

/** Price of one seat, in the smallest currency unit. */
export const SEAT_PRICE_MINOR = Number(process.env.SEAT_PRICE_MINOR ?? 4900);
export const SEAT_CURRENCY = process.env.SEAT_CURRENCY ?? "usd";

/**
 * Whether the instrument establishes what compliance/parental-consent.md §3
 * relies upon.
 *
 * §3: "A card issued to the child is not evidence of a parent. Where the payment
 * instrument is a prepaid or youth card, the transaction does not establish what
 * the method relies upon, and the flow must fall back to another method rather
 * than accepting it."
 *
 * Stripe reports funding as credit, debit, prepaid or unknown, and does not
 * report whether a card is a youth card, which §3 records as an open item. A
 * prepaid card is refused. `unknown` is accepted, because refusing every card
 * the network declines to classify would reject legitimate parents in order to
 * catch a case we cannot actually detect either way.
 *
 * The funding type is used to make this decision and is then discarded. §4
 * enumerates what is retained and requires minimality applied everywhere rather
 * than accumulating whatever the payment system happens to return, so there is
 * deliberately no column for it.
 */
export function instrumentEstablishesParent(
  funding: string | null | undefined,
): { ok: true } | { ok: false; reason: string } {
  if (funding === "prepaid") {
    return {
      ok: false,
      reason:
        "The card used is a prepaid card, which does not establish that the cardholder is a parent or guardian.",
    };
  }
  return { ok: true };
}
