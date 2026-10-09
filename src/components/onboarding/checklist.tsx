import { markStepDone } from "@/lib/onboarding/actions";
import type { OnboardingStep } from "@/lib/onboarding/checklist";
import { Button, ButtonLink, Card } from "@/components/ui";

/**
 * The persona checklist's rendering. All state arrives decided — the pure
 * builder owns gating; this component only presents it. A step that waits on
 * vouching is explained rather than offered: there is no skip, and no way to
 * mark a derived step done, on purpose (spec art_ztdch8TP, "no bypass").
 */
export function OnboardingChecklist({ steps }: { steps: readonly OnboardingStep[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((step, index) => (
        <li key={step.id}>
          <Card className={step.done ? "bg-parchment-deep/40" : undefined}>
            <div className="flex flex-wrap items-baseline gap-2">
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                  step.done ? "bg-brand text-white" : "bg-parchment-deep text-ink-soft"
                }`}
                aria-hidden
              >
                {step.done ? "✓" : index + 1}
              </span>
              <h3 className="font-medium">{step.title}</h3>
              {step.done ? (
                <span className="text-xs font-medium text-ink-faint">Done</span>
              ) : null}
            </div>

            <p className="mt-2 max-w-xl text-sm text-ink-soft">{step.description}</p>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              {step.done ? null : step.waitsOnVouching ? (
                <p className="text-sm text-ink-faint">
                  This opens when a co-operative has vouched for you.
                </p>
              ) : (
                <ButtonLink href={step.href}>{step.linkLabel}</ButtonLink>
              )}

              {!step.done && step.selfMarkable && !step.waitsOnVouching ? (
                <form action={markStepDone}>
                  <input type="hidden" name="stepId" value={step.id} />
                  <Button variant="secondary">Mark done</Button>
                </form>
              ) : null}

              {step.docSlug ? (
                <a
                  href={`/docs/${step.docSlug}`}
                  className="text-sm text-ink-soft underline"
                >
                  Read the guide
                </a>
              ) : null}
            </div>
          </Card>
        </li>
      ))}
    </ol>
  );
}
