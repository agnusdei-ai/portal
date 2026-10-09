import type { OnboardingPersona } from "@/lib/types";

/**
 * The per-persona guides (spec art_ztdch8TP, "Personas and guided onboarding").
 * Plain language on purpose: the reader is on their first day. The tutor
 * persona's docs ship with phase B (option C, ruled 2026-10-09): the same
 * trust path as every persona, plus the agent-interface guide for
 * household-systems integrators.
 */

export type DocSection = { heading: string; body: string[] };

export type Doc = {
  slug: string;
  persona: OnboardingPersona;
  title: string;
  intro: string;
  sections: DocSection[];
};

/** The two sentences every persona's onboarding path must say plainly. */
export const CERTIFIES_ADULTHOOD = "The portal certifies that you are an adult and nothing else.";
export const STANDING_IS_EARNED = "Standing is earned in the co-operative, never issued by the platform.";

export type PersonaDocs = {
  persona: OnboardingPersona;
  label: string;
  intro: string;
  docs: Doc[];
};

export const DOC_SETS: PersonaDocs[] = [
  {
    persona: "parent",
    label: "For parents and co-op members",
    intro: "The default path — from the consent transaction to your first exchange trade.",
    docs: [
      {
        slug: "parent-getting-started",
        persona: "parent",
        title: "Getting started",
        intro: "What this portal is, and the order things happen in.",
        sections: [
          {
            heading: "Three things happen, in order",
            body: [
              "First, consent: you read a short notice and make a one-time card payment. The receipt from your card issuer is the parental consent, and the payment creates your household account. Browsing the catalogue, the co-op directory and the exchange is free and needs no account; the payment is what makes your household real to us.",
              "Second, verification: a one-time identity check that proves you are an adult. It opens participation — posting, replying, licence keys.",
              "Third, everything else: finding a co-operative, trading materials, keeping bookmarks. None of it is urgent, and the checklist on the portal home walks you through it a step at a time.",
            ],
          },
          {
            heading: "What we keep, and what we never see",
            body: [
              "Your account holds a billing state, a seat record per child, and your bookmarks. That is nearly all of it. What your child studies, and everything about how you homeschool, lives on your own hardware — we have no table for it, and the tests that keep it that way fail the build if one appears.",
              CERTIFIES_ADULTHOOD,
              STANDING_IS_EARNED,
            ],
          },
        ],
      },
      {
        slug: "parent-verification-walkthrough",
        persona: "parent",
        title: "The verification walkthrough",
        intro: "What the adult check asks for, where your details go, and what comes back.",
        sections: [
          {
            heading: "What happens",
            body: [
              "You fill in a short form — name, date of birth, address, email, phone — and choose a document: a driver's license or, if you prefer or if you live outside the United States, a passport. International residents verify by passport.",
              "The form goes straight to our verification provider, Socure, which checks the identity against records and walks you through photographing your document, with an optional selfie to match it. Nothing you type or photograph is stored here: the portal relays it and keeps none of it.",
            ],
          },
          {
            heading: "What comes back, and what you keep",
            body: [
              "The check ends in one of five states. Verified, and participation is open. Retry — a detail needs correcting, and the page will say which. In review — a person is looking, which usually takes a short time. Declined — you can appeal to the operator, who can re-run the check.",
              "What we keep afterwards is an attestation: that you are verified, by which document type, with a reference number. No name, no birthdate, no address, no image. The provider's own retention of your documents is governed by their contract with the operator, not by this portal.",
            ],
          },
        ],
      },
      {
        slug: "parent-coop-membership",
        persona: "parent",
        title: "Co-op membership",
        intro: "Finding a co-operative, and what the directory does and does not publish.",
        sections: [
          {
            heading: "Finding one",
            body: [
              "The directory lists co-operatives by state, region and meeting day. If a co-op has published a meeting area, the directory can order results by distance from you — in coarse bands like \"about 15–20 mi away\", never a pin on your house. Your location is used in your browser and is never sent to us.",
            ],
          },
          {
            heading: "What a listing is for",
            body: [
              "A listing advertises that a co-operative exists and is open to enquiry. The meeting place itself is arranged privately: you enquire through the exchange, the reply comes back through the portal relay, and the details travel there rather than in the directory.",
              "This is deliberate. A directory of meeting places would be a directory of where children gather. The co-op tells you who they are; you arrange where to meet, the way neighbours always have.",
            ],
          },
        ],
      },
      {
        slug: "parent-waiver-plain-language",
        persona: "parent",
        title: "The communication waiver, in plain language",
        intro: "The one disclosure to actually read before you trade with another household.",
        sections: [
          {
            heading: "The part that matters",
            body: [
              "Replies on the exchange are not end-to-end encrypted. The operator can read them, and must be able to: when money changes hands between strangers, the ability to investigate a complaint is a safety feature, not a convenience. That is the whole disclosure, and it is in the waiver you accept before your first participation.",
              "Replies arrive in your portal inbox and stay in the portal — the other side never learns your email or your identity on any other service.",
            ],
          },
          {
            heading: "The rules the waiver carries",
            body: [
              "No cryptocurrency, and no payments off the platform: solicitations for bitcoin, wallets, or steering to Cash App, Venmo, Zelle or the like are refused automatically and recorded. No automated harvesting — the search and exchange are for people reading, not scripts scraping. Breaking these ends your session, and repeats end your account's participation.",
              "When the waiver changes, you accept the new version once at your next participation — a single yes, then you are done.",
            ],
          },
        ],
      },
    ],
  },
  {
    persona: "educator",
    label: "For K-12 educators",
    intro: "The same identity check as everyone, then a co-operative's vouch.",
    docs: [
      {
        slug: "educator-onboarding",
        persona: "educator",
        title: "Educator onboarding",
        intro: "The path from a paid household account to teaching through the exchange.",
        sections: [
          {
            heading: "The order of things",
            body: [
              "Verify first: the same one-time adult check every account passes. The educator path adds nothing to it and exempts nothing from it.",
              "Then vouching: an identified co-operative names you as one of its educators. That vouch — not the platform — is what elevates your account to the educator class, which may post class offerings to families. Until it lands, your account takes part as a household, like any parent's.",
              CERTIFIES_ADULTHOOD,
              STANDING_IS_EARNED,
            ],
          },
        ],
      },
      {
        slug: "educator-vouching",
        persona: "educator",
        title: "Vouching, explained",
        intro: "Why a co-operative, and not a certificate from us.",
        sections: [
          {
            heading: "Who vouches, and what it means",
            body: [
              "A vouch is a named institution putting its standing behind you: the co-operative that knows your work says, in its own name, that you teach. The platform does not credential teachers — it could not, without becoming a licensing body, and a badge bought with a fee would say nothing about how you teach.",
              "A vouch can be revoked by the co-operative that made it, at any time, and the educator class goes with it. That is not a bug; it is the trust working.",
            ],
          },
          {
            heading: "What it opens, and what it never does",
            body: [
              "A current vouch lets you post class offerings and be reached by parents about instruction. It never replaces verification — the adult check comes first for every persona — and it confers no profile or directory entry on this platform. Your reputation lives where it was earned: in the co-operative.",
            ],
          },
        ],
      },
      {
        slug: "educator-etiquette",
        persona: "educator",
        title: "Exchange etiquette",
        intro: "How teaching offers work on a relay, without chat.",
        sections: [
          {
            heading: "How the exchange works",
            body: [
              "Listings are offers and openings; replies travel through the portal relay and arrive in the other side's inbox. There is no chat and no comment thread — a reply is a considered letter, not a message bubble.",
              "Say what you offer, for what ages, at what cadence, and what the family arranges with you privately. The exchange advertises existence, the way a co-op listing does; the arrangement itself happens outside the portal, by whatever channels the two of you choose.",
            ],
          },
          {
            heading: "The lines that are not etiquette but rules",
            body: [
              "Payment stays off the platform and out of listings: no wallet addresses, no payment-app handles. The heuristics refuse them and record the attempt. Children are never participants — replies come from adults, and anything addressed to a child is removed.",
            ],
          },
        ],
      },
      {
        slug: "educator-what-verification-confers",
        persona: "educator",
        title: "What verification does and does not confer",
        intro: "The one page to send anyone who calls the portal a certification body.",
        sections: [
          {
            heading: "What it says",
            body: [
              CERTIFIES_ADULTHOOD,
              "It says the person passed a one-time identity check — document, and where enabled a selfie match — through our verification provider. That is the whole claim.",
            ],
          },
          {
            heading: "What it does not say",
            body: [
              STANDING_IS_EARNED,
              "Verification is not a teaching credential, not a background check certificate for framing, not a rank, and not a profile. It opens the same doors for every persona: posting, replying, and being reachable. Everything a parent might want to know about you as a teacher is a matter for the co-operative that vouches for you — ask them, not us.",
            ],
          },
        ],
      },
    ],
  },
  {
    persona: "guide",
    label: "For homeschool guides",
    intro: "Leading classes, publishing a co-operative, and the duties that follow.",
    docs: [
      {
        slug: "guide-onboarding",
        persona: "guide",
        title: "Guide onboarding",
        intro: "The same trust path as every persona, aimed at leading classes.",
        sections: [
          {
            heading: "Verify, then be vouched",
            body: [
              "Verify first: the one-time adult check every account passes. Then a co-operative vouches for you as a guide — the platform does not credential guides, and a vouch is what elevates your account to the guide class.",
              CERTIFIES_ADULTHOOD,
              STANDING_IS_EARNED,
              "With the vouch in place you work with your co-operative: its openings and your classes are arranged through the relay, and its listing is how families find you.",
            ],
          },
        ],
      },
      {
        slug: "guide-coop-publishing",
        persona: "guide",
        title: "Co-op publishing rules",
        intro: "What a listing may say about where you meet — and the line it may not cross.",
        sections: [
          {
            heading: "Advertise existence, never meeting places",
            body: [
              "A listing says that a co-operative exists, who it is for, and how to enquire. It does not publish where you meet. The meeting place is arranged privately, through the relay, with the families who enquire.",
              "The one exception is yours to make: a co-operative may publish a meeting area at metro granularity — a point within its region and a distance tolerance, like \"within 25 miles of this area\". It is how families answer \"is this within reach?\". It is not an address, a postcode, or a pin on the building.",
            ],
          },
          {
            heading: "Why the line is hard",
            body: [
              "A directory of meeting places is a directory of where children gather, and this platform does not keep one. The structural tests fail the build if a street address or postcode column appears. Publish the area if it helps families; leave it out if it does not — listings without one are ordered by state and region, never buried.",
            ],
          },
        ],
      },
      {
        slug: "guide-moderation-disputes",
        persona: "guide",
        title: "Moderation and dispute handling",
        intro: "What you can act on yourself, and what you hand to the operator.",
        sections: [
          {
            heading: "Your tools",
            body: [
              "Report a listing that breaks the rules and it goes to the operator with the reason you gave; reports are visible to the moderation surface, not to the exchange. Vouches are yours to grant and yours to revoke — when someone's standing in your co-operative ends, the vouch ends with it, and their guide or educator class goes with the vouch.",
              "Disputes about a payment on the consent transaction are between the family, their card issuer, and the operator: a chargeback suspends the seat automatically while it is investigated. You are never asked to arbitrate one.",
            ],
          },
          {
            heading: "What the operator reads, and why",
            body: [
              "Relay replies are readable by the operator for safety review — that disclosure is in the waiver every participant accepts. If a family reports a problem with an arrangement made through your co-operative, the exchange record is what an investigation works from; keep yours factual and leave the negotiating to the families.",
            ],
          },
        ],
      },
    ],
  },
  {
    persona: "tutor",
    label: "For tutors (agent to agent)",
    intro: "The same identity check as everyone, a co-operative's vouch, and an API your own systems call.",
    docs: [
      {
        slug: "tutor-onboarding",
        persona: "tutor",
        title: "Tutor onboarding",
        intro: "The path from a paid household account to a household agent system that can find your standing.",
        sections: [
          {
            heading: "The order of things",
            body: [
              "Verify first: the same one-time adult check every account passes. The tutor path adds nothing to it and exempts nothing from it.",
              "Then vouching: an identified co-operative names you as one of its tutors. That vouch — not the platform — is what elevates your account to the tutor's teaching class, the same class an educator's vouch grants. The platform does not credential tutors: a co-operative's vouch is what elevates your account, and it can be revoked by the co-operative that made it, with the class going with it.",
              CERTIFIES_ADULTHOOD,
              STANDING_IS_EARNED,
              "Then, and only then, the agent: point the tutoring system you own at the portal's vetted discovery API. It answers as you, only while you are signed in, and only with trust signals.",
            ],
          },
          {
            heading: "What the portal never does",
            body: [
              "The portal does not tutor. Your tutoring configuration — how your agent works, what it says, when it runs — and every tutoring session live in household-owned systems. The portal keeps no table for any of it, on purpose: there is nothing here to enroll into, and nothing here that could leak how you teach.",
              "The portal does not host an assistant for tutors either. That idea waits on its own specification and safety review; the API that exists today is discovery and standing, read-only.",
            ],
          },
        ],
      },
      {
        slug: "tutor-agent-interface",
        persona: "tutor",
        title: "The agent-interface guide",
        intro: "For household-systems integrators: how an agent signs in as you, what the discovery API returns, and where the portal's part ends.",
        sections: [
          {
            heading: "Enrollment: the session is the credential",
            body: [
              "There are no API keys to mint and no tokens to store. A household agent system calls the API as you — it presents your own signed-in portal session, the same cookies your browser holds — so it inherits every rule your session already carries: the 30-minute idle sign-out, and the second factor when one is enrolled.",
              "Because the agent acts as your principal, the account gates apply to it in the same order they apply to you: a valid session, the second-factor challenge when enrolled, and a verified-adult attestation. A refusal comes back as a typed error — unauthenticated, assurance-required, or verification-required — with the fix named in the repo's agent-interface guide, never a redirect.",
            ],
          },
          {
            heading: "What the API returns — trust signals, never identity PII",
            body: [
              "GET /api/agents/tutors returns standing: an opaque account handle, the vouch classes held, when each vouch was made, and the co-operative that made it — its own published name and region, nothing more. It also returns which communication axes connect you to them.",
              "What it never returns: names, contact details, addresses, birthdates, document data, or any other person's verification state. The response is marked no-store, so trust data about other adults does not sit in caches. Your agent does not need more than this to answer \"who is vouched, by whom, and can we talk?\" — if a build asks for more, the build is asking the wrong question.",
            ],
          },
          {
            heading: "The boundary: tutoring runs in household systems",
            body: [
              "The portal's part ends at that response. Sessions with students, scheduling, tutoring records, and the agent's own behaviour live in the systems you own and control. The portal never brokers contact either: reaching a family still travels the way it always has, through the exchange reply relay or a co-operative's enquiry path.",
              CERTIFIES_ADULTHOOD,
              STANDING_IS_EARNED,
            ],
          },
        ],
      },
    ],
  },
];

export function getDoc(slug: string): Doc | undefined {
  for (const set of DOC_SETS) {
    const doc = set.docs.find((d) => d.slug === slug);
    if (doc) return doc;
  }
  return undefined;
}

export function allDocs(): Doc[] {
  return DOC_SETS.flatMap((set) => set.docs);
}
