import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { ListingForm } from "@/components/exchange/listing-form";
import { Card } from "@/components/ui";

export default async function NewListingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/exchange/new");

  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (!account) redirect("/setup");

  const { data: waiver } = await supabase
    .from("communication_waivers")
    .select("account_id")
    .eq("account_id", account.id)
    .is("withdrawn_at", null)
    .maybeSingle();

  if (!waiver) redirect("/exchange/waiver");

  const { data: held } = await supabase
    .from("account_participants")
    .select("class")
    .eq("account_id", account.id);

  const classes = (held ?? []).map((h) => h.class);

  return (
    <div className="mx-auto max-w-2xl px-6 py-14">
      <h1 className="text-3xl font-semibold">Post a listing</h1>
      <p className="mt-3 text-ink-soft">
        Listings describe a thing or an offer. They never describe a person.
      </p>

      <Card className="mt-6 text-sm text-ink-soft">
        <p className="font-medium text-ink">What cannot go in a listing</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Any child&apos;s name, age, grade or photograph.</li>
          <li>A member list, roster or list of who attends.</li>
          <li>An email address, telephone number or social handle.</li>
          <li>A street address. Region only, and you agree where to meet privately.</li>
        </ul>
        <p className="mt-3">
          The exchange carries adults only. Households talk to each other,
          parents and educators talk about instruction, and guides and
          co-operatives talk about leading classes. There is no route that
          reaches a child, and there is no participant class for one.
        </p>
        <p className="mt-3">
          We do not carry tutoring, childcare or lift-sharing at all. Those need
          identity checks and reputation records that this product deliberately
          cannot build, so the honest answer is that we are the wrong place for
          them.
        </p>
      </Card>

      <div className="mt-8">
        <ListingForm classes={classes} />
      </div>
    </div>
  );
}
