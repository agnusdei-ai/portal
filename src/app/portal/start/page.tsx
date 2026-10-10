import { redirect } from "next/navigation";
import Link from "next/link";

import { OnboardingChecklist } from "@/components/onboarding/checklist";
import { Button, Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import {
  PERSONA_COPY,
  buildChecklist,
  checklistComplete,
  isPersona,
  vouchClass,
} from "@/lib/onboarding/checklist";
import { choosePersona, currentOnboarding } from "@/lib/onboarding/actions";
import type { OnboardingPersona, VerificationState } from "@/lib/types";

export default async function StartPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/portal/start");

  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (!account) redirect("/setup");

  const [{ data: attestation }, onboarding, { data: vouches }, { count: listings }] =
    await Promise.all([
      supabase
        .from("verification_attestations")
        .select("state")
        .eq("account_id", account.id)
        .maybeSingle(),
      currentOnboarding(account.id),
      supabase
        .from("coop_affiliations")
        .select("class")
        .eq("account_id", account.id)
        .is("revoked_at", null),
      supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("posted_by_account", account.id),
    ]);

  // Replies are RLS-scoped (0001_zones.sql): the caller sees exactly the ones
  // they are a party of, so one row is proof enough of participation.
  const { data: replies } = await supabase.from("listing_replies").select("id").limit(1);

  const persona = isPersona(onboarding.persona) ? onboarding.persona : "parent";
  const neededClass = vouchClass(persona);
  const steps = buildChecklist(persona, {
    hasAccount: true,
    verificationState: (attestation?.state ?? null) as VerificationState | null,
    vouched:
      neededClass !== null && (vouches ?? []).some((v) => v.class === neededClass),
    hasParticipated: (listings ?? 0) > 0 || (replies?.length ?? 0) > 0,
    markedSteps: onboarding.marked_steps,
  });
  const done = checklistComplete(steps);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-semibold">Let&apos;s get you started</h1>
      <p className="mt-2 max-w-xl text-sm text-ink-soft">
        We&apos;ll help you through the steps for your role. Some steps require
        verification or confirmation from a co-op.
      </p>

      <h2 className="mt-10 text-lg font-medium">How will you use Agnus Dei?</h2>
      <p className="mt-1 max-w-xl text-sm text-ink-soft">
        Choose the description that fits you best. You can change it later.
        Everyone who takes part in the Exchange must complete an adult identity check.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(Object.keys(PERSONA_COPY) as OnboardingPersona[]).map((p) => (
          <Card
            key={p}
            className={p === persona ? "border-brand ring-1 ring-brand" : undefined}
          >
            <form action={choosePersona}>
              <input type="hidden" name="persona" value={p} />
              <h3 className="font-medium">{PERSONA_COPY[p].label}</h3>
              <p className="mt-1 min-h-16 text-sm text-ink-soft">
                {PERSONA_COPY[p].blurb}
              </p>
              <div className="mt-3">
                {p === persona ? (
                  <Button variant="secondary" disabled>
                    Selected
                  </Button>
                ) : (
                  <Button variant="ghost">Choose this role</Button>
                )}
              </div>
            </form>
          </Card>
        ))}
      </div>

      <h2 className="mt-10 text-lg font-medium">Your steps</h2>
      {done ? (
        <Card className="mt-4 border-brand/40">
          <h3 className="font-medium">You&apos;re all set with these steps.</h3>
          <p className="mt-1 max-w-xl text-sm text-ink-soft">
            You can return to your home page to manage licences,
            saved resources and Exchange replies.
          </p>
        </Card>
      ) : null}
      <div className="mt-4">
        <OnboardingChecklist steps={steps} />
      </div>

      <Card className="mt-8">
        <h3 className="font-medium">Private messaging is optional</h3>
        <p className="mt-2 text-sm text-ink-soft">
          When you want to talk privately with another adult, you may choose
          Locuto or Signal. Neither app is needed for membership or identity
          verification, and this is not a required onboarding step.
        </p>
        <Link href="/portal/messaging" className="mt-3 inline-block text-sm font-medium text-brand underline">
          Learn about messaging choices
        </Link>
      </Card>

      <Card className="mt-8 bg-parchment-deep/40">
        <h3 className="font-medium">What the identity check means</h3>
        <p className="mt-1 max-w-xl text-sm text-ink-soft">
          The check confirms that you are an adult. It is not a teaching
          qualification or a background check. A co-op confirms teaching roles —{" "}
          <Link href="/docs" className="underline">
            the guides explain
          </Link>
          .
        </p>
      </Card>
    </div>
  );
}
