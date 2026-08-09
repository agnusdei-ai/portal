import "server-only";

import Stripe from "stripe";

let client: Stripe | null = null;

export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  client ??= new Stripe(key, { apiVersion: "2025-02-24.acacia" });
  return client;
}

/** One seat, in the smallest currency unit. Must be non-zero: see checkout.ts. */
export const SEAT_PRICE_MINOR = Number(process.env.SEAT_PRICE_MINOR ?? 4900);
export const SEAT_CURRENCY = process.env.SEAT_CURRENCY ?? "usd";

/**
 * parental-consent.md §3: a prepaid card is not evidence of a parent, and the
 * flow must fall back rather than accept it. Stripe cannot report a youth card,
 * which §3 records as an open item, and `unknown` is accepted because refusing
 * every unclassified card rejects real parents to catch nothing.
 *
 * The funding type is used here and discarded; §4's retained list is exhaustive,
 * so no column exists for it.
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
