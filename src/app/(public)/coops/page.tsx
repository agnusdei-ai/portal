import type { Metadata } from "next";

import { listCoops } from "@/lib/onboarding/queries";
import { ButtonLink, Card } from "@/components/ui";

export const metadata: Metadata = {
  title: "Homeschool co-op directory",
  description:
    "Find homeschool co-ops by state and region. Free to browse — join yours with a code and your Bede setup fills in automatically.",
};

export default async function CoopsPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state } = await searchParams;
  const coops = await listCoops({ state });

  return (
    <div className="mx-auto max-w-5xl px-6 py-14">
      <h1 className="text-4xl font-semibold">Co-ops</h1>
      <p className="mt-3 max-w-xl text-ink-soft">
        Co-ops publish their shared curriculum and meeting day here. If yours is
        listed, joining pre-fills those subjects during setup.
      </p>

      {coops.length === 0 ? (
        <Card className="mt-8 text-sm text-ink-soft">
          No co-ops listed{state ? ` in ${state.toUpperCase()}` : ""} yet. Directors can
          publish theirs from the portal.
        </Card>
      ) : (
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {coops.map((c) => (
            <li key={c.id}>
              <Card className="h-full">
                <h2 className="text-lg font-semibold">{c.name}</h2>
                <p className="text-sm text-ink-faint">
                  {[c.region, c.state_code].filter(Boolean).join(", ")}
                  {c.meeting_day ? ` · Meets ${c.meeting_day}` : ""}
                </p>
                <p className="mt-3 text-sm text-ink-soft">{c.description}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Card className="mt-10 flex flex-wrap items-center justify-between gap-4 p-6">
        <p className="max-w-md text-sm text-ink-soft">
          Don&apos;t see yours? Directors can list a co-op and hand members a join code.
        </p>
        <ButtonLink href="/login?mode=signup&role=director" variant="secondary">
          List your co-op
        </ButtonLink>
      </Card>
    </div>
  );
}
