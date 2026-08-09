import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { CATEGORIES } from "@/lib/exchange/schema";
import { ReplyForm } from "@/components/exchange/reply-form";
import { Card } from "@/components/ui";
import type { Listing } from "@/lib/types";

export default async function ListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase.from("listings").select("id, category, title, body, state_code, region, posted_as, state, expires_at, created_at").eq("id", id).maybeSingle();
  if (!data) notFound();
  const listing = data as Listing;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="mx-auto max-w-2xl px-6 py-14">
      <p className="text-xs text-ink-faint">
        {CATEGORIES.find((c) => c.value === listing.category)?.label} ·{" "}
        {listing.region}, {listing.state_code}
      </p>
      <h1 className="mt-2 text-3xl font-semibold">{listing.title}</h1>
      <p className="mt-6 leading-relaxed whitespace-pre-wrap text-ink-soft">
        {listing.body}
      </p>

      <Card className="mt-10">
        <h2 className="font-medium">Reply</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Your reply reaches the poster here in the portal. Neither of you sees the
          other&apos;s Locuto identity, and replying does not add anyone to your
          contacts.
        </p>
        <div className="mt-4">
          {user ? (
            <ReplyForm listingId={listing.id} />
          ) : (
            <p className="text-sm text-ink-faint">
              Replying needs a household licence. Browsing does not.
            </p>
          )}
        </div>
      </Card>

      <p className="mt-6 text-xs text-ink-faint">
        Expires {new Date(listing.expires_at).toLocaleDateString()}.
      </p>
    </div>
  );
}
