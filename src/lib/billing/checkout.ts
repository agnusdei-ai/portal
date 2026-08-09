import "server-only";

import { SEAT_CURRENCY, SEAT_PRICE_MINOR, stripe } from "@/lib/billing/stripe";
import { consentStatement, NOTICE } from "@/lib/consent/notice";

/**
 * The transaction that is at once paywall, consent instrument and data boundary
 * (portal.md §3). Three details are load-bearing, each marked below; changing
 * any of them voids the consent method rather than merely altering checkout.
 */
export async function createConsentCheckout(args: {
  consentRecordId: string;
  childAccountName: string;
  customerEmail: string;
  origin: string;
}) {
  return stripe().checkout.sessions.create({
    mode: "payment",
    customer_email: args.customerEmail,
    line_items: [
      {
        // Load-bearing: one seat per transaction. Consent is per child, so a
        // higher quantity takes several children's consent in one charge naming
        // one of them, and a bulk or gift path breaks it outright
        // (counsel-packet-40).
        quantity: 1,
        price_data: {
          currency: SEAT_CURRENCY,
          unit_amount: SEAT_PRICE_MINOR,
          product_data: {
            name: `Locuto household licence — ${args.childAccountName}`,
            description:
              "One seat. Completing this purchase is your parental consent for this account.",
          },
        },
      },
    ],
    // Load-bearing: the consent statement is on the purchase screen itself, and
    // the line item above names the child account (parental-consent.md §3).
    custom_text: {
      submit: { message: consentStatement(args.childAccountName) },
    },
    // The processor holds an opaque id only; the retained record is ours.
    metadata: {
      consent_record_id: args.consentRecordId,
      notice_version: NOTICE.version,
    },
    payment_intent_data: {
      // Load-bearing: a real captured charge, not a hold. The issuer's
      // notification to the cardholder is what verifies the consent.
      capture_method: "automatic",
      metadata: { consent_record_id: args.consentRecordId },
    },
    success_url: `${args.origin}/setup/complete?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${args.origin}/setup/consent?cancelled=1`,
  });
}
