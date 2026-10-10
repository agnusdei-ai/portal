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
    label: "Parent or co-op member",
    blurb:
      "Find a co-op, explore resources and exchange materials with other adults.",
  },
  educator: {
    label: "Teacher",
    blurb:
      "Share co-op classes after a co-op confirms your teaching role.",
  },
  guide: {
    label: "Homeschool guide",
    blurb:
      "Connect with co-ops that need someone to lead group classes.",
  },
  tutor: {
    label: "Tutor",
    blurb:
      "A co-op can confirm your role. Household-owned tools may use the limited discovery API; tutoring is not hosted here.",
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
  title: "Confirm you are an adult",
  description:
    "Our verification partner checks your identity so you can post or reply in the Exchange. We keep the result, not your identity documents.",
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
    title: "Ask your co-op to confirm your role",
    description: `The identity check confirms you are an adult. A co-op that knows your work must confirm your role before you can post as one of its ${word.people}.`,
    href: "/coops",
    linkLabel: "Find a co-op",
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
        title: "Review the notice and consent",
        description:
          "Review the notice and complete the required payment on your own card. It provides the consent needed to create your household account.",
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
        title: "Explore local co-ops",
        description:
          "Browse co-ops by state or area. Contact a co-op through its available enquiry path to learn more.",
        href: "/coops",
        linkLabel: "Find co-ops",
        docSlug: "parent-coop-membership",
        done: marked("coop"),
        selfMarkable: true,
        waitsOnVouching: false,
      },
      {
        id: "participate",
        title: "Take part in the exchange",
        description:
          "Post a listing or reply to one after accepting the separate Exchange communication waiver.",
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
        title: "Explore the tutor discovery guide",
        description:
          "Tutoring stays on household-owned systems. The Portal provides limited co-op and tutor discovery information, not tutoring or private messages.",
        href: "/docs/tutor-agent-interface",
        linkLabel: "Read the tutor discovery guide",
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
          ? "Post a co-op class offering and read replies in the Portal."
          : "Reply in the Portal and arrange group classes with the co-op that confirmed your role.",
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
