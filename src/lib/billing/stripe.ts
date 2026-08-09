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

export { instrumentEstablishesParent } from "@/lib/billing/instrument";
