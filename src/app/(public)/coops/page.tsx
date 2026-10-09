import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { ButtonLink, Card } from "@/components/ui";
import { CoopDirectory } from "@/components/coops/directory";

export const metadata: Metadata = {
  title: "Homeschool co-op directory",
  description:
    "Find homeschool co-ops by state and region. Free to browse, no account needed.",
};

export default async function CoopsPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state } = await searchParams;
  const supabase = await createClient();
  let q = supabase
    .from("coop_listings")
    .select(
      "id, name, state_code, region, description, meeting_day, meeting_area_lat, meeting_area_lng, meeting_area_radius_mi",
    )
    .eq("is_listed", true)
    .order("name");
  if (state) q = q.eq("state_code", state.toUpperCase());
  const { data } = await q;
  const coops = data ?? [];

  return (
    <div className="mx-auto max-w-5xl px-6 py-14">
      <h1 className="text-4xl font-semibold">Co-ops</h1>
      <p className="mt-3 max-w-xl text-ink-soft">
        Co-operatives list themselves here. Enquire through the exchange; who
        belongs to a co-op is the co-op&apos;s business and is not recorded by us.
      </p>

      {coops.length === 0 ? (
        <Card className="mt-8 text-sm text-ink-soft">
          No co-ops listed{state ? ` in ${state.toUpperCase()}` : ""} yet. Directors can
          publish theirs from the portal.
        </Card>
      ) : (
        <CoopDirectory coops={coops} />
      )}

      <Card className="mt-10 flex flex-wrap items-center justify-between gap-4 p-6">
        <p className="max-w-md text-sm text-ink-soft">
          Don&apos;t see yours? Directors can list a co-op so families can find it.
        </p>
        <ButtonLink href="/setup?role=director" variant="secondary">
          List your co-op
        </ButtonLink>
      </Card>
    </div>
  );
}
