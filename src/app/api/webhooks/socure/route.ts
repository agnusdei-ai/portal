import { NextResponse, type NextRequest } from "next/server";

import { createServiceClient } from "@/lib/supabase/server";
import {
  buildUpdate,
  buildWrite,
  parseWebhookEvent,
  verifyWebhookSignature,
} from "@/lib/verification/webhook";

/**
 * Socure's evaluation-completion callback, the only writer of attestation
 * outcomes. Signature-verified against the tenant's webhook secret and
 * replay-safe by construction: the update touches only in-flight states.
 *
 * The payload can carry identity attributes, so nothing here is logged —
 * operator diagnostics name the event kind and evaluation reference, never
 * the body.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.SOCURE_WEBHOOK_SECRET;
  const rawBody = await req.text();
  const header = req.headers.get("socure-signature");

  if (!secret || !verifyWebhookSignature({ secret, header, rawBody })) {
    // Indistinguishable refusal for missing secret, missing header, bad
    // digest, or stale timestamp: an unsigned caller learns nothing.
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const event = parseWebhookEvent(payload);
  if (!event) {
    // A recognized vendor sends only events the portal enables; anything else
    // is acknowledged so the vendor does not retry a permanently useless
    // delivery.
    return NextResponse.json({ received: true, applied: false });
  }

  const write = buildWrite(event);
  if (!write) {
    return NextResponse.json({ received: true, applied: false });
  }

  const { patch, guardStates } = buildUpdate(write);
  const { data, error } = await createServiceClient()
    .from("verification_attestations")
    .update(patch)
    .eq("vendor_evaluation_id", event.vendorEvaluationId)
    .in("state", guardStates)
    .select("id");

  if (error) {
    // Operator-readable, non-PII: the vendor reference and Postgres code.
    console.error(
      `socure webhook write failed for evaluation ${event.vendorEvaluationId}: ${error.code}`,
    );
    return NextResponse.json({ error: "write failed" }, { status: 500 });
  }

  // Zero rows covers both replays (guarded) and unknown references (no
  // attestation was anchored — the intake always anchors first), and neither
  // case asks the vendor to redeliver.
  return NextResponse.json({ received: true, applied: (data ?? []).length > 0 });
}
