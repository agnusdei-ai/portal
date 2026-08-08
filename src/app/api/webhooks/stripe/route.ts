import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";

import { instrumentEstablishesParent, stripe } from "@/lib/billing/stripe";
import { getRecord, grantConsent, refuseConsent } from "@/lib/consent/record";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * The point at which consent becomes evidenced and a seat comes into existence.
 *
 * compliance/parental-consent.md §2 orders the ceremony so that the child's
 * account and key material are created only after consent, because creating them
 * first is collection before consent and no later consent cures it. The portal
 * never creates a child account at all, so what is issued here is a seat: a
 * licence the household build presents in order to run.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !secret) {
    return NextResponse.json({ error: "unsigned" }, { status: 400 });
  }

  // The raw body is required for signature verification; parsing it first would
  // change the bytes the signature covers.
  const raw = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `bad signature: ${message}` }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  // The processor holds only an opaque record id. Everything else about this
  // ceremony, including who the parent is, is read from our own consent record.
  const consentRecordId = session.metadata?.consent_record_id;

  if (!consentRecordId) {
    // Not one of ours. Acknowledged so Stripe stops retrying.
    return NextResponse.json({ received: true });
  }

  if (session.payment_status !== "paid") {
    // Nothing was charged, so the issuer notified nobody and §3's verification
    // did not occur. No seat.
    return NextResponse.json({ received: true });
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  if (!paymentIntentId) {
    return NextResponse.json({ received: true });
  }

  const intent = await stripe().paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge"],
  });
  const charge = intent.latest_charge as Stripe.Charge | null;

  // §3: a card issued to the child is not evidence of a parent. The funding type
  // decides and is then discarded; §4 permits no column for it.
  const verdict = instrumentEstablishesParent(
    charge?.payment_method_details?.card?.funding,
  );

  if (!verdict.ok) {
    await stripe().refunds.create({ payment_intent: paymentIntentId });
    await refuseConsent({
      recordId: consentRecordId,
      reason: verdict.reason,
      processorReference: paymentIntentId,
    });
    return NextResponse.json({ received: true, consent: "refused" });
  }

  // Idempotency. Stripe retries deliveries, and a second one must not mint a
  // second seat against one charge. The consent record is the lock: it leaves
  // `notice_acknowledged` exactly once, so a replay sees `granted` and stops.
  const record = await getRecord(consentRecordId);
  if (!record || record.state !== "notice_acknowledged") {
    return NextResponse.json({ received: true, consent: record?.state ?? "unknown" });
  }

  const db = createServiceClient();

  // The account comes into existence here and not one step earlier. This is the
  // moment docs/portal.md §3 designates: the charge has succeeded, so the
  // paywall, the consent instrument and the data boundary have all been crossed
  // by the same event. An account created at the notice step would have been a
  // family-keyed object standing before consent.
  const { data: account, error: accountError } = await db
    .from("accounts")
    .upsert(
      { owner_user_id: record.owner_user_id },
      { onConflict: "owner_user_id" },
    )
    .select("id")
    .single();

  if (accountError || !account) {
    return NextResponse.json(
      { error: accountError?.message ?? "account not created" },
      { status: 500 },
    );
  }

  // No licence token here. Minting one in a webhook means a secret coming into
  // existence with nobody present to receive it, and the only places left to put
  // it are this table in plaintext or the processor's metadata, which is a third
  // party holding a credential to a household's own software. The parent mints
  // it from an authenticated session instead; see src/lib/setup/licence-action.ts.
  const { data: seat, error } = await db
    .from("seats")
    .insert({ account_id: account.id, state: "active" })
    .select("id")
    .single();

  if (error || !seat) {
    // Fail loudly rather than acknowledging. Stripe retries on a 500, and a
    // charged parent without a seat is the one outcome that must not be kept
    // quietly.
    return NextResponse.json(
      { error: error?.message ?? "seat not issued" },
      { status: 500 },
    );
  }

  await grantConsent({
    recordId: consentRecordId,
    accountId: account.id,
    processorReference: paymentIntentId,
    completedAt: new Date(intent.created * 1000),
    seatId: seat.id,
  });

  return NextResponse.json({ received: true, consent: "granted" });
}
