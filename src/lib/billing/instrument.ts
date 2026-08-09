/**
 * parental-consent.md §3: a prepaid card is not evidence of a parent, and the
 * flow must fall back rather than accept it. Stripe cannot report a youth card,
 * which §3 records as an open item, and `unknown` is accepted because refusing
 * every unclassified card rejects real parents to catch nothing.
 *
 * The funding type is used here and discarded; §4's retained list is exhaustive,
 * so no column exists for it.
 *
 * Pure, and deliberately not behind `server-only`: the rule it encodes is the
 * one most worth testing directly.
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
