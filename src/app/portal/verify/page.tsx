import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { IntakeForm } from "@/components/verification/intake-form";
import { Alert, ButtonLink, Card } from "@/components/ui";
import type { VerificationState } from "@/lib/types";

const OUTCOME_COPY: Record<VerificationState, { title: string; body: string }> = {
  pending: {
    title: "Verification in progress",
    body: "Your identity evaluation is under way. Document capture happens next; when the check completes, this page shows the outcome.",
  },
  verified: {
    title: "You're verified",
    body: "Your identity check is complete. Participating in the exchange — posting, replying, accepting the communication waiver, issuing licence keys — is open to you.",
  },
  retry_required: {
    title: "A detail needs correcting",
    body: "The verification provider asked for a correction. Check the reason below, then submit the form again with a new document capture.",
  },
  manual_review: {
    title: "Your verification is in review",
    body: "A reviewer is looking at your evaluation. This usually takes a short time; when it completes, this page shows the outcome.",
  },
  declined: {
    title: "Verification was declined",
    body: "The verification provider declined this evaluation. If you believe this is a mistake, contact the operator, who can review the decision and re-run the check.",
  },
};

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ required?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/portal/verify");

  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (!account) redirect("/setup");

  // The account reads its own attestation through RLS; there is no other read
  // path. The row carries states and reason codes only — never identity data.
  const { data: attestation } = await supabase
    .from("verification_attestations")
    .select("state, reason_codes")
    .eq("account_id", account.id)
    .maybeSingle();

  const { required } = await searchParams;
  const state = attestation?.state ?? null;
  const copy = state ? OUTCOME_COPY[state] : null;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-semibold">Verify your identity</h1>
      <p className="mt-3 max-w-xl text-sm text-ink-soft">
        The exchange is for adults. A one-time identity check — run by our
        verification provider, Socure — proves that, and then participation is
        open: posting, replying, and everything else on the exchange.
      </p>
      <p className="mt-3 max-w-xl text-sm text-ink-faint">
        The details you give here are sent to Socure for the check and are not
        stored by the portal. What the portal keeps is the outcome: that you
        verified, and when.
      </p>

      {required ? (
        <div className="mt-6">
          <Alert>
            The exchange needs this verification before you can take part.
          </Alert>
        </div>
      ) : null}

      {copy ? (
        <Card className="mt-8">
          <h2 className="text-lg font-medium">{copy.title}</h2>
          <p className="mt-2 text-sm text-ink-soft">{copy.body}</p>
          {attestation && attestation.reason_codes.length > 0 && state !== "verified" ? (
            <p className="mt-3 text-xs text-ink-faint">
              Reason codes: {attestation.reason_codes.join(", ")}
            </p>
          ) : null}
        </Card>
      ) : null}

      {state === "verified" ? (
        <div className="mt-6">
          <ButtonLink href="/portal">Back to your household</ButtonLink>
        </div>
      ) : state === "manual_review" || state === "declined" ? null : (
        // pending, retry_required and first-time all run the intake: pending
        // re-runs get a fresh evaluation (a new capture token), and a retry
        // resubmits with the reason surfaced above.
        <div className="mt-8">
          <IntakeForm
            reasonCodes={state === "retry_required" ? (attestation?.reason_codes ?? []) : []}
          />
        </div>
      )}
    </div>
  );
}
