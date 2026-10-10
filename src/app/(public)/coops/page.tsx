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
      <h1 className="text-4xl font-semibold">Find a homeschool co-op</h1>
      <p className="mt-3 max-w-xl text-ink-soft">
        Explore co-ops that have chosen to be listed here. See their general
        meeting area, schedule, and what they offer. We do not publish member lists.
      </p>

      {coops.length === 0 ? (
        <Card className="mt-8 text-sm text-ink-soft">
          No co-ops listed{state ? ` in ${state.toUpperCase()}` : ""} yet.
          Try another area or check back later.
        </Card>
      ) : (
        <CoopDirectory coops={coops} />
      )}

      <Card className="mt-10 flex flex-wrap items-center justify-between gap-4 p-6">
        <p className="max-w-md text-sm text-ink-soft">
          Lead a co-op? Learn how the directory works before getting started.
        </p>
        <ButtonLink href="/docs" variant="secondary">
          Learn more
        </ButtonLink>
      </Card>
    </div>
  );
}
