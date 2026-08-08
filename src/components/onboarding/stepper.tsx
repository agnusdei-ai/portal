"use client";

import { usePathname } from "next/navigation";

import { STEPS, stepIndex } from "@/lib/onboarding/steps";
import type { OnboardingStep } from "@/lib/types";

/**
 * `reached` comes from the server (the family's recorded step); the current step
 * is derived from the URL, so the layout doesn't need to know the active route.
 */
export function Stepper({ reached }: { reached: OnboardingStep }) {
  const pathname = usePathname();
  const currentIdx = STEPS.findIndex((s) => pathname.startsWith(s.path));
  const reachedIdx = stepIndex(reached);

  return (
    <nav aria-label="Setup progress">
      <ol className="space-y-1">
        {STEPS.map((step, i) => {
          const isCurrent = i === currentIdx;
          const isDone = i < reachedIdx;
          const isLocked = i > reachedIdx;

          return (
            <li key={step.key}>
              <div
                aria-current={isCurrent ? "step" : undefined}
                className={`flex items-start gap-3 rounded-md px-3 py-2 ${
                  isCurrent ? "bg-white ring-1 ring-rule" : ""
                }`}
              >
                <span
                  aria-hidden
                  className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                    isDone
                      ? "bg-brand text-white"
                      : isCurrent
                        ? "text-brand ring-2 ring-brand"
                        : "bg-parchment-deep text-ink-faint"
                  }`}
                >
                  {isDone ? "✓" : i + 1}
                </span>
                <span className="min-w-0">
                  <span
                    className={`block text-sm font-medium ${
                      isLocked ? "text-ink-faint" : "text-ink"
                    }`}
                  >
                    {step.title}
                    {step.optional ? (
                      <span className="ml-1.5 text-xs font-normal text-ink-faint">
                        optional
                      </span>
                    ) : null}
                  </span>
                  {isCurrent ? (
                    <span className="mt-0.5 block text-xs text-ink-soft">{step.blurb}</span>
                  ) : null}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
