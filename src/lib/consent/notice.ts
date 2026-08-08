import { createHash } from "node:crypto";

/**
 * The direct notice to parents.
 *
 * Substance is transcribed from locuto `compliance/direct-notice-to-parents.md`
 * §2, which states that the text is the content and that formatting for the
 * screen is a product question. Do not edit the wording here to make it read
 * better: that document is normative, and a divergence means the notice we
 * evidence is not the notice that was approved.
 *
 * §3 of that document constrains what the notice must not say. Any change here
 * needs bumping NOTICE_VERSION, because compliance/parental-consent.md §4
 * retains the version and hash in order to establish what a parent was actually
 * shown rather than what the current notice says.
 */
export const NOTICE_VERSION = "2026-08-08.1";

export const NOTICE_SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: "What Locuto is",
    body: [
      "Locuto is a private messenger. Messages are encrypted on the device that sends them and can be read only on the device that receives them. Agnus Dei, which publishes Locuto and operates the service that carries messages, cannot read them. This is not a promise about how the service is run. It is a property of how it is built, and it holds regardless of who owns the company or who asks.",
    ],
  },
  {
    heading: "What is collected from a child",
    body: [
      "Setting up an account creates cryptographic keys, which remain on the child's device. The service that carries messages receives encrypted messages it cannot open, a rotating address that changes several times a day and cannot be traced back to the account, and, if notifications are turned on, a code that lets the child's device be woken when a message is waiting.",
      "Locuto does not ask for a telephone number. It does not ask for a home address. It does not read the contacts stored on the device. It does not build a profile, show advertising, or record who the child talks to.",
    ],
  },
  {
    heading: "How that information is used",
    body: [
      "Solely to deliver messages and to keep the service running. Nothing is sold, and nothing is shared for advertising or analysis. The full list of anyone who receives anything at all is published in the privacy notice and is short.",
    ],
  },
  {
    heading: "How long it is kept",
    body: [
      "A message waiting for a device that is switched off is deleted once it has been collected, and in any case after fourteen days. Nothing else about the conversation is kept anywhere except on the two devices taking part in it.",
    ],
  },
  {
    heading: "What a parent can do",
    body: [
      "A parent may ask what has been collected from their child, may ask for it to be deleted, and may refuse to allow any further collection. Because almost nothing is collected, the answer to the first request is short, and the parent's control over the child's messages lies with the child's device rather than with a request to the company. How this works in practice, and what it does and does not reach, is set out in full in the parental review procedure, which is worth reading before consenting.",
    ],
  },
  {
    heading:
      "One thing a parent should understand before consenting, stated plainly because it surprises people",
    body: [
      "Setting up the account does not give the parent the ability to read the child's messages. The same encryption that prevents the company from reading them prevents everyone else from doing so, and there is no parental copy and no way to request one. A parent can be named as the child's recovery contact, which makes it possible to get the account back if the device is lost, and that is a different thing from being able to read it. Locuto is a private channel for the child, and whether that is appropriate for a particular child at a particular age is the parent's judgement to make. The purpose of stating it here is to make sure the judgement is made with the facts in hand rather than discovered afterwards.",
    ],
  },
];

export const NOTICE_LEAD =
  "Before a Locuto account is set up for a child under thirteen, a parent or guardian is asked to read this and to give consent.";

/**
 * The consent wording. `direct-notice-to-parents.md` §2 leaves this to
 * `parental-consent.md`, and records that under the payment-card route it reads
 * as a confirmation accompanying the purchase rather than as a separate
 * ceremony. §3 of that document requires the purchase screen to state in terms
 * that completing the purchase constitutes consent, and to identify the child
 * account by the name the parent chose.
 */
export function consentStatement(childAccountName: string): string {
  return `Completing this purchase constitutes your parental consent to the creation of a Locuto account for ${childAccountName}, and to the collection described above.`;
}

/**
 * Hash of the exact text rendered, so the retained hash cannot drift from what
 * was on screen. Computed from the same constants the page renders rather than
 * from a separate copy of the wording.
 */
export const NOTICE_SHA256: string = createHash("sha256")
  .update(
    JSON.stringify({
      version: NOTICE_VERSION,
      lead: NOTICE_LEAD,
      sections: NOTICE_SECTIONS,
    }),
  )
  .digest("hex");
