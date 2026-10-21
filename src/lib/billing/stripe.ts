import "server-only";

import Stripe from "stripe";

let client: Stripe | null = null;

export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  client ??= new Stripe(key, { apiVersion: "2026-09-30.endive" });
  return client;
}

/**
 * The seat's amount, read from the Stripe Price the owner configures from the
 * contract. A zero charge notifies nobody and voids the consent method, so it
 * is refused rather than charged.
 */
export async function seatPrice(): Promise<{ unitAmount: number; currency: string }> {
  const id = process.env.STRIPE_SEAT_PRICE_ID;
  if (!id) throw new Error("STRIPE_SEAT_PRICE_ID is not set");
  const price = await stripe().prices.retrieve(id);
  if (!price.unit_amount) throw new Error("the seat price must be a non-zero fixed amount");
  return { unitAmount: price.unit_amount, currency: price.currency };
}

export { instrumentEstablishesParent } from "@/lib/billing/instrument";
