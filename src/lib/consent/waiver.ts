import { createHash } from "node:crypto";

/**
 * The communication waiver.
 *
 * Distinct from the parental consent in `src/lib/consent/notice.ts`, and the two
 * must never be presented as one thing. That one is a parent consenting, under
 * COPPA, to collection from their child, and it is evidenced by a card
 * transaction. This one is an adult opting in to talk to other adults here.
 *
 * The first disclosure is the one that matters. Locuto's entire claim is that
 * the operator cannot read messages. The exchange is not that channel, the
 * operator can read it, and a product that let a parent discover the difference
 * afterwards would have traded on a guarantee it was not providing. It is stated
 * first, in those words, and not softened.
 */
export const WAIVER_VERSION = "2026-08-08.1";

export const WAIVER_LEAD =
  "The exchange is where you talk to other adults about materials, classes and co-operatives. Please read this before you use it, because it does not work the way Locuto messaging works.";

export const WAIVER_SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: "These messages are not end-to-end encrypted",
    body: [
      "Locuto messages are encrypted so that we cannot read them. Exchange messages are not. We can read what you post and what you send in a reply, and so can anyone we are legally required to show it to.",
      "This is deliberate rather than an oversight. An operator carrying trade between strangers has to be able to establish what happened on its own service when something goes wrong, and an operator that cannot read anything cannot do that. If you want a conversation nobody but the other person can read, have it in Locuto instead, once you have exchanged codes in person.",
    ],
  },
  {
    heading: "Adults only, with no exceptions",
    body: [
      "The exchange carries communication between adults. No child takes part in it, in any capacity. You may not name a child, include a child's age, grade or photograph, or pass a message to or from a child.",
      "We do not carry private tutoring, childcare, lift-sharing or any other arrangement that would put an adult with a child. We are not willing to build the identity checking that would be needed to make those safe, so we decline them rather than offering them badly.",
    ],
  },
  {
    heading: "Who you can talk to",
    body: [
      "Households may talk to each other about materials and information. Parents and educators may talk to each other about instruction. Guides and co-operatives may talk to each other about leading classes. Those are the only routes, and there is no route that reaches a child.",
      "An educator is reachable here only through a co-operative that has vouched for them. We do not check anyone's credentials ourselves, and you should not read a vouch as our endorsement: it means a named co-operative is willing to stand behind that person.",
    ],
  },
  {
    heading: "What we keep, and why",
    body: [
      "We record which account posted each listing and sent each reply. It is never shown to anyone reading the exchange, and it exists so that a report can be acted on and a fraud can be investigated.",
      "We do not build a public profile from it, we do not publish a posting history, and we do not operate a reputation score. Listings expire and are not archived.",
    ],
  },
  {
    heading: "Meeting in person is between you",
    body: [
      "You arrange handovers yourselves. Meet in a public place. We do not vet the people you meet, we are not a party to what you agree, and we do not hold anyone's money.",
      "Fraud is a crime and we will cooperate with a lawful investigation of one, but the first protection is your own caution.",
    ],
  },
  {
    heading: "You can withdraw this",
    body: [
      "You may withdraw at any time, in the portal. Your listings stop being shown and you can no longer post or reply. Withdrawing this does not touch your household licence, your Locuto account, or the parental consent you gave for your child.",
    ],
  },
];

export const WAIVER_SHA256: string = createHash("sha256")
  .update(
    JSON.stringify({
      version: WAIVER_VERSION,
      lead: WAIVER_LEAD,
      sections: WAIVER_SECTIONS,
    }),
  )
  .digest("hex");
