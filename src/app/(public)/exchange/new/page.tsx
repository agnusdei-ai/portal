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
      <h1 className="text-3xl font-semibold">What would you like to share?</h1>
      <p className="mt-3 text-ink-soft">
        Tell other families about a book, supply, class, or co-op opening.
        Please leave personal details out of the listing.
      </p>

      <Card className="mt-6 text-sm text-ink-soft">
        <p className="font-medium text-ink">Keep your listing useful and safe</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Any child&apos;s name, age, grade or photograph.</li>
          <li>A member list, roster or list of who attends.</li>
          <li>An email address, telephone number or social handle.</li>
          <li>A street address. A general area is enough. Agree where to meet privately.</li>
        </ul>
        <p className="mt-3">
          This exchange is for adults. Parents can exchange materials and ask
          educators about co-op classes. Children cannot post or reply.
        </p>
        <p className="mt-3">
          Please do not post offers for private tutoring, childcare, or rides.
          Those arrangements are not supported here.
        </p>
      </Card>

      <div className="mt-8">
        <ListingForm classes={classes} />
      </div>
    </div>
  );
}
