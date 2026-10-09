import type { OnboardingPersona } from "@/lib/types";

/**
 * The persona checklist (spec art_ztdch8TP, "Personas and guided onboarding").
 *
 * Pure and import-free on purpose: the checklist is a decision, and the tests
 * execute the decision directly. Four personas ship — parent/co-op member is
 * the default path; educator, guide, and tutor are the same trust path (verify
 * first, then a co-operative's vouch) with vouching-gated steps. The tutor's
 * final step is guidance to the shipped agent API (phase B, option C): the
 * portal deliberately keeps no record of a household agent system, so like the
 * parent's co-op discovery it is the path's one human-choice step.
 *
 * The no-bypass rule is structural: every other step's `done` comes from a
 * system fact — the consent transaction, the attestation, an unrevoked vouch,
 * a listing or reply — and no caller can mark a derived step done.
 */

export type { OnboardingPersona as Persona };

export const PERSONA_COPY: Record<OnboardingPersona, { label: string; blurb: string }> = {
  parent: {
    label: "Parent / co-op member",
    blurb:
      "The default path: consent, verification, finding a co-operative, and taking part in the exchange.",
  },
  educator: {
    label: "K-12 educator",
    blurb:
      "Verify first; a co-operative's vouch elevates your account to the educator class. The platform does not credential — vouching alone does.",
  },
  guide: {
    label: "Homeschool guide",
    blurb:
      "Verify first; a co-operative's vouch elevates your account to the guide class. The platform does not credential — vouching alone does.",
  },
  tutor: {
    label: "Tutor (agent to agent)",
    blurb:
      "Verify first; a co-operative's vouch elevates your account to the tutor's teaching class. Then your own household systems reach the vetted discovery API as you — tutoring runs there, never here.",
  },
};

export function isPersona(value: unknown): value is OnboardingPersona {
  return (
    value === "parent" || value === "educator" || value === "guide" || value === "tutor"
  );
}

export type ChecklistFacts = {
  /** The §3 consent transaction happened: the account row exists. */
  hasAccount: boolean;
  verificationState: import("@/lib/types").VerificationState | null;
  /** An unrevoked coop_affiliations row for this persona's class. */
  vouched: boolean;
  /** Posted a listing or a reply. */
  hasParticipated: boolean;
  /** Step ids the account marked done themselves. Ignored for every derived step. */
  markedSteps: readonly string[];
};

export type OnboardingStep = {
  id: string;
  title: string;
  description: string;
  href: string;
  linkLabel: string;
  /** The matching persona doc, when one exists. */
  docSlug: string | null;
  done: boolean;
  /**
   * The account may mark this step done. Every other step derives from a
   * system fact and ignores marks entirely — that is the whole bypass rule.
   */
  selfMarkable: boolean;
  /** True while a co-operative vouch is still owed; the step is explained, not offered. */
  waitsOnVouching: boolean;
};

const VERIFY_STEP: Omit<OnboardingStep, "done" | "selfMarkable" | "waitsOnVouching"> = {
  id: "verify",
  title: "Verify that you are an adult",
  description:
    "A one-time identity check with our verification provider opens participation everywhere. Your details go to the check and are not kept here.",
  href: "/portal/verify",
  linkLabel: "Start verification",
  docSlug: null,
};

/**
 * The class a persona's vouch elevates to (coop_affiliations.class, 0002).
 * Tutors ride the teaching class — "an adult offering instruction, vouched
 * for by a co-operative" — which is the class the agent API publishes to
 * parent principals through the parent ↔ teacher axis. A parent's path needs
 * no vouch, so null.
 */
export function vouchClass(persona: OnboardingPersona): "teacher" | "guide" | null {
  if (persona === "guide") return "guide";
  if (persona === "parent") return null;
  return "teacher";
}

/** Educator, guide, and tutor share one trust path; only the vouch's class and words differ. */
function vouchStep(
  persona: Exclude<OnboardingPersona, "parent">,
): Omit<OnboardingStep, "done" | "selfMarkable" | "waitsOnVouching"> {
  const word = {
    educator: { people: "educators", klass: "educator" },
    guide: { people: "guides", klass: "guide" },
    tutor: { people: "tutors", klass: "tutor's teaching" },
  }[persona];
  return {
    id: "vouch",
    title: "Get vouched by a co-operative",
    description: `The portal certifies that you are an adult and nothing else. It does not credential ${word.people}: a co-operative's vouch is what elevates your account to the ${word.klass} class.`,
    href: "/coops",
    linkLabel: "Find a co-operative to vouch for you",
    docSlug:
      persona === "educator"
        ? "educator-vouching"
        : persona === "tutor"
          ? "tutor-onboarding"
          : "guide-onboarding",
  };
}

export function buildChecklist(
  persona: OnboardingPersona,
  facts: ChecklistFacts,
): OnboardingStep[] {
  const verified = facts.verificationState === "verified";
  const marked = (id: string) => facts.markedSteps.includes(id);

  if (persona === "parent") {
    return [
      {
        ...VERIFY_STEP,
        id: "consent",
        title: "Start with the consent transaction",
        description:
          "The one-time notice and card charge create your household account; the issuer's notification to you is the parental consent.",
        href: "/setup",
        linkLabel: "Review the notice",
        docSlug: "parent-getting-started",
        done: facts.hasAccount,
        selfMarkable: false,
        waitsOnVouching: false,
      },
      {
        ...VERIFY_STEP,
        done: verified,
        selfMarkable: false,
        waitsOnVouching: false,
      },
      {
        id: "coop",
        title: "Find your co-operative",
        description:
          "Browse the directory by state and region. A listing advertises existence — the meeting place is arranged privately, through the relay.",
        href: "/coops",
        linkLabel: "Browse co-operatives",
        docSlug: "parent-coop-membership",
        done: marked("coop"),
        selfMarkable: true,
        waitsOnVouching: false,
      },
      {
        id: "participate",
        title: "Take part in the exchange",
        description:
          "Post a listing or reply to one. The communication waiver is accepted at first participation.",
        href: "/exchange",
        linkLabel: "Open the exchange",
        docSlug: "parent-waiver-plain-language",
        done: facts.hasParticipated,
        selfMarkable: false,
        waitsOnVouching: false,
      },
    ];
  }

  if (persona === "tutor") {
    return [
      {
        ...VERIFY_STEP,
        done: verified,
        selfMarkable: false,
        waitsOnVouching: false,
      },
      {
        ...vouchStep(persona),
        done: facts.vouched,
        selfMarkable: false,
        waitsOnVouching: false,
      },
      {
        id: "enroll",
        title: "Connect your household agent system",
        description:
          "Your tutoring runs on systems you own, never here. Point them at the portal's vetted discovery API: it speaks for you only while you are signed in, verified, and vouched, and it returns trust signals — never identity details.",
        href: "/docs/tutor-agent-interface",
        linkLabel: "Read the agent-interface guide",
        docSlug: "tutor-agent-interface",
        // The portal keeps no record of a household agent system — by design —
        // so, like the parent's co-op discovery, this is a human-choice step.
        done: marked("enroll"),
        selfMarkable: true,
        waitsOnVouching: !facts.vouched,
      },
    ];
  }

  const docSlug = persona === "educator" ? "educator-etiquette" : "guide-onboarding";
  return [
    {
      ...VERIFY_STEP,
      done: verified,
      selfMarkable: false,
      waitsOnVouching: false,
    },
    {
      ...vouchStep(persona),
      done: facts.vouched,
      selfMarkable: false,
      waitsOnVouching: false,
    },
    {
      id: "participate",
      title: persona === "educator" ? "Offer instruction" : "Work with your co-operative",
      description:
        persona === "educator"
          ? "Post a class offering as an educator, and reply through the relay."
          : "Reply through the relay; leading classes is arranged with the co-operative that vouched for you.",
      href: "/exchange",
      linkLabel: "Open the exchange",
      docSlug,
      done: facts.hasParticipated,
      selfMarkable: false,
      waitsOnVouching: !facts.vouched,
    },
  ];
}

/**
 * Whether the account may mark `stepId` done on this persona's checklist. The
 * only source of truth is the definitions above: a mark is honoured exactly
 * when it names a step the account's own persona offers as self-markable.
 */
export function isSelfMarkable(persona: OnboardingPersona, stepId: string): boolean {
  const empty: ChecklistFacts = {
    hasAccount: false,
    verificationState: null,
    vouched: false,
    hasParticipated: false,
    markedSteps: [],
  };
  return buildChecklist(persona, empty).some(
    (step) => step.id === stepId && step.selfMarkable,
  );
}

/** Every step done. The checklist stays up until it is. */
export function checklistComplete(steps: readonly OnboardingStep[]): boolean {
  return steps.every((step) => step.done);
}
