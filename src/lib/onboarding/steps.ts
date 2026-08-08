import type { OnboardingStep } from "@/lib/types";

export interface StepDef {
  key: Exclude<OnboardingStep, "complete">;
  path: string;
  title: string;
  blurb: string;
  /** Optional steps can be skipped without blocking the Bede handoff. */
  optional?: boolean;
}

/**
 * Order matters: the wizard refuses to render a step whose predecessors are
 * unfinished, so a parent cannot deep-link past the data Bede needs.
 */
export const STEPS: StepDef[] = [
  {
    key: "family",
    path: "/onboarding/family",
    title: "Your family",
    blurb: "What we call your school, and which state's records we generate.",
  },
  {
    key: "students",
    path: "/onboarding/students",
    title: "Your students",
    blurb: "Bede plans per child, so it needs to know who it's teaching.",
  },
  {
    key: "curriculum",
    path: "/onboarding/curriculum",
    title: "Your curriculum",
    blurb: "The books you already own. This is what Bede teaches from.",
  },
  {
    key: "coop",
    path: "/onboarding/coop",
    title: "Your co-op",
    blurb: "Join with a code and shared subjects fill in automatically.",
    optional: true,
  },
  {
    key: "review",
    path: "/onboarding/review",
    title: "Review",
    blurb: "Confirm what we hand to Bede.",
  },
];

export const FIRST_STEP = STEPS[0];

export function stepIndex(step: OnboardingStep): number {
  if (step === "complete") return STEPS.length;
  return STEPS.findIndex((s) => s.key === step);
}

export function stepDef(step: OnboardingStep): StepDef | undefined {
  return STEPS.find((s) => s.key === step);
}

export function nextStep(step: Exclude<OnboardingStep, "complete">): OnboardingStep {
  const i = stepIndex(step);
  return i >= STEPS.length - 1 ? "complete" : STEPS[i + 1].key;
}

/**
 * Where a family should be sent when they hit /onboarding. Also used to bounce
 * anyone who jumps ahead of their furthest completed step.
 */
export function resumePath(step: OnboardingStep): string {
  if (step === "complete") return "/dashboard";
  return stepDef(step)?.path ?? FIRST_STEP.path;
}

/** True when `target` is further along than the family has actually reached. */
export function isAhead(target: OnboardingStep, reached: OnboardingStep): boolean {
  return stepIndex(target) > stepIndex(reached);
}
