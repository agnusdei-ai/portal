import Link from "next/link";
import { redirect } from "next/navigation";

import { seatNamesForAccount } from "@/lib/consent/record";
import { createClient } from "@/lib/supabase/server";
import { verificationGate } from "@/lib/verification/gate";
import { LicenceForm } from "@/components/setup/licence-form";
import { ButtonLink, Card } from "@/components/ui";
import type { PortalRole, Seat } from "@/lib/types";

const ROLE_COPY: Record<PortalRole, string> = {
  account_owner: "Account owner",
  coop_director: "Co-op director",
  moderator: "Moderator",
};

export default async function PortalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/portal");

  const { data: account } = await supabase
    .from("accounts")
    .select("*")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  // No account means the §3 transaction has not happened, and there is nothing
  // to show because nothing has been created.
  if (!account) redirect("/setup");

  const [{ data: seats }, { data: roles }, { data: attestation }] = await Promise.all([
    supabase.from("seats").select("*").eq("account_id", account.id).order("issued_at"),
    supabase.from("user_roles").select("*").eq("user_id", user.id),
    supabase
      .from("verification_attestations")
      .select("state")
      .eq("account_id", account.id)
      .maybeSingle(),
  ]);

  const verified = verificationGate(attestation?.state ?? null) === "allowed";

  // The child account names live in the consent schema, which no client can
  // reach. Read here, server-side, having already established that this user
  // owns this account.
  const names = await seatNamesForAccount(account.id);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-3xl font-semibold">Your household</h1>
        {roles?.length ? (
          <span className="text-sm text-ink-faint">
            {roles.map((r) => ROLE_COPY[r.role]).join(" · ")}
          </span>
        ) : null}
        <Link
          href="/portal/settings"
          className="ml-auto text-sm text-ink-soft underline"
        >
          Settings
        </Link>
      </div>

      {!verified ? (
        <Card className="mt-6 border-brand/40">
          <h2 className="font-medium">Verify your identity to take part</h2>
          <p className="mt-1 max-w-xl text-sm text-ink-soft">
            The exchange is for adults. A one-time identity check with our
            verification provider opens posting, replying, and licence keys —
            your details go to the check and are not kept here.
          </p>
          <div className="mt-4">
            <ButtonLink href="/portal/verify">Start verification</ButtonLink>
          </div>
        </Card>
      ) : null}

      <h2 className="mt-10 text-lg font-medium">Seats</h2>
      <p className="mt-1 max-w-xl text-sm text-ink-soft">
        One seat per child. The seat authorises your household build to run.
        Everything about what your child studies lives on your own hardware and
        never reaches us.
      </p>

      <ul className="mt-4 space-y-3">
        {(seats ?? []).map((seat: Seat) => (
          <li key={seat.id}>
            <Card>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-medium">
                  {names.get(seat.id) ?? "Seat"}
                </h3>
                <span className="text-xs text-ink-faint">
                  {seat.state === "active" ? "Active" : "Revoked"} · issued{" "}
                  {new Date(seat.issued_at).toLocaleDateString()}
                </span>
              </div>
              <div className="mt-4">
                <LicenceForm
                  seatId={seat.id}
                  alreadyIssued={Boolean(seat.licence_issued_at)}
                />
              </div>
            </Card>
          </li>
        ))}
      </ul>

      <Card className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-md text-sm text-ink-soft">
          Adding another child needs its own notice and its own consent, because
          consent is per child rather than per household.
        </p>
        <ButtonLink href="/setup/notice" variant="secondary">
          Add a child
        </ButtonLink>
      </Card>

      <h2 className="mt-12 text-lg font-medium">The exchange</h2>
      <p className="mt-1 max-w-xl text-sm text-ink-soft">
        Buy, sell and trade materials with other households, and find co-ops.
        Replies arrive here rather than in Locuto, and neither side learns the
        other&apos;s Locuto identity.
      </p>
      <div className="mt-4 flex gap-3">
        <ButtonLink href="/exchange">Browse the exchange</ButtonLink>
        <ButtonLink href="/portal/bookmarks" variant="secondary">
          Your bookmarks
        </ButtonLink>
        <Link
          href="/exchange/new"
          className="inline-flex items-center text-sm text-ink-soft underline"
        >
          Post a listing
        </Link>
      </div>
    </div>
  );
}
