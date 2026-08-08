import "server-only";

import { SEAT_CURRENCY, SEAT_PRICE_MINOR, stripe } from "@/lib/billing/stripe";
import { consentStatement, NOTICE_VERSION } from "@/lib/consent/notice";

/**
 * Creates the transaction that is simultaneously the paywall, the consent
 * instrument and the data boundary (docs/portal.md §3).
 *
 * Three properties are load-bearing and each is a line below.
 *
 * `mode: "payment"` produces a genuine charge rather than an authorisation hold.
 * compliance/parental-consent.md §3: "the notification to the cardholder is what
 * supplies verification, so the transaction must be a genuine charge rather than
 * an authorization hold that is released without notice." A setup-mode session
 * or a trial with a zero charge would leave nothing for the issuer to notify,
 * and would silently void the consent method.
 *
 * The consent statement appears on the purchase screen itself. §3: the
 * transaction is "presented as the consent step rather than merely coinciding
 * with it, meaning the purchase screen states in terms that completing the
 * purchase constitutes parental consent."
 *
 * The line item names the child account. §3: the screen "identifies the child
 * account by the name the parent chose for it during setup."
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
        // Always one. The licence is per seat and consent is per child
        // (parental-consent.md §3), so a quantity above one would be several
        // children's consent taken in a single transaction naming one of them.
        // There is deliberately no bulk or gift path: counsel-packet-40 records
        // that an institutionally purchased seat breaks the consent method,
        // and a co-operative buying seats for its families is exactly that.
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
    custom_text: {
      submit: { message: consentStatement(args.childAccountName) },
    },
    // Read back by the webhook. Metadata is Stripe-side and is not the consent
    // record; §4's retained list lives in the consent schema.
    metadata: {
      consent_record_id: args.consentRecordId,
      notice_version: NOTICE_VERSION,
    },
    payment_intent_data: {
      // Captured immediately, so the cardholder is notified of a real charge.
      capture_method: "automatic",
      metadata: { consent_record_id: args.consentRecordId },
    },
    success_url: `${args.origin}/setup/complete?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${args.origin}/setup/consent?cancelled=1`,
  });
}
