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
      <h1 className="text-3xl font-semibold">Getting started</h1>
      <p className="mt-2 max-w-xl text-sm text-ink-soft">
        Your first days here, one step at a time. The steps stay until they are
        done — none is skippable, because each is what lets the next mean
        something.
      </p>

      <h2 className="mt-10 text-lg font-medium">Which path is yours?</h2>
      <p className="mt-1 max-w-xl text-sm text-ink-soft">
        Every path passes the same identity check. What differs is where it
        takes you afterwards. You can change this later.
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
                    Your path
                  </Button>
                ) : (
                  <Button variant="ghost">Use this path</Button>
                )}
              </div>
            </form>
          </Card>
        ))}
      </div>

      <h2 className="mt-10 text-lg font-medium">Your steps</h2>
      {done ? (
        <Card className="mt-4 border-brand/40">
          <h3 className="font-medium">Your path is set up.</h3>
          <p className="mt-1 max-w-xl text-sm text-ink-soft">
            Everything here is done. From now on the portal home is your desk:
            seats, bookmarks and replies.
          </p>
        </Card>
      ) : null}
      <div className="mt-4">
        <OnboardingChecklist steps={steps} />
      </div>

      <Card className="mt-8 bg-parchment-deep/40">
        <h3 className="font-medium">What verification does and does not confer</h3>
        <p className="mt-1 max-w-xl text-sm text-ink-soft">
          The portal certifies that you are an adult and nothing else. Standing
          is earned in the co-operative, never issued by the platform —{" "}
          <Link href="/docs" className="underline">
            the guides explain
          </Link>
          .
        </p>
      </Card>
    </div>
  );
}
