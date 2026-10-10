import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { currentAccountId } from "@/lib/account";
import {
  buildConversations,
  formatStamp,
  type Conversation,
} from "@/lib/inbox/conversations";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES } from "@/lib/exchange/schema";
import { ReplyForm } from "@/components/exchange/reply-form";
import { UnreadBadge } from "@/components/inbox/unread-badge";
import { ButtonLink, Card } from "@/components/ui";
import type { Listing, ListingReply } from "@/lib/types";

export const metadata: Metadata = {
  title: "Replies",
  description: "Replies to your listings, and your own replies, threaded by listing.",
};

const ROLE_LINE: Record<Conversation["role"], string> = {
  owner: "Replies to your listing",
  sender: "You replied to this listing",
  owner_and_sender: "Your listing · you have replied here too",
};

function categoryLabel(listing: Listing | null): string | null {
  if (!listing) return null;
  return CATEGORIES.find((c) => c.value === listing.category)?.label ?? null;
}

function ConversationCard({
  conversation,
  accountId,
}: {
  conversation: Conversation;
  accountId: string;
}) {
  const meta = [
    ROLE_LINE[conversation.role],
    categoryLabel(conversation.listing),
    conversation.listing
      ? `${conversation.listing.region}, ${conversation.listing.state_code}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li>
      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          {conversation.listing ? (
            <Link
              href={`/exchange/${conversation.listing.id}`}
              className="font-medium text-ink underline decoration-rule hover:decoration-ink"
            >
              {conversation.listing.title}
            </Link>
          ) : (
            <span className="font-medium text-ink">A listing no longer available</span>
          )}
          <UnreadBadge
            conversationId={conversation.listingId}
            latestIncomingAt={conversation.latestIncomingAt}
            markRead
          />
        </div>
        <p className="mt-1 text-xs text-ink-faint">{meta}</p>

        <ul className="mt-4 space-y-3">
          {conversation.replies.map((reply) => {
            const mine = reply.from_account === accountId;
            return (
              <li
                key={reply.id}
                className={`rounded-md border p-3 ${
                  mine ? "border-transparent bg-parchment/60" : "border-rule bg-white"
                }`}
              >
                <p className="whitespace-pre-wrap text-sm text-ink">{reply.body}</p>
                <p className="mt-1 text-xs text-ink-faint">
                  {mine ? "You" : "Other participant"} · {formatStamp(reply.created_at)}
                </p>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 border-t border-rule pt-4">
          <ReplyForm listingId={conversation.listingId} />
        </div>
      </Card>
    </li>
  );
}

export default async function InboxPage() {
  const accountId = await currentAccountId();
  if (!accountId) redirect("/setup");

  const supabase = await createClient();

  // No from_account or listing filter here on purpose: "reply visible to the
  // two parties" (0001_zones.sql) is the whole permission system, and
  // duplicating it in the application would be a second check to drift. What
  // RLS returns — the reader's own replies plus replies to the reader's
  // listings, and nothing else — is exactly what renders.
  const { data: replies } = await supabase
    .from("listing_replies")
    .select("*")
    .order("created_at");

  const visible = (replies ?? []) as ListingReply[];
  const listingIds = [...new Set(visible.map((r) => r.listing_id))];

  let listings: Listing[] = [];
  if (listingIds.length > 0) {
    const { data } = await supabase.from("listings").select("*").in("id", listingIds);
    listings = (data ?? []) as Listing[];
  }

  const conversations = buildConversations(visible, listings, accountId);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-3xl font-semibold">Replies</h1>
        <ButtonLink href="/exchange" variant="secondary">
          Browse the exchange
        </ButtonLink>
      </div>
      <p className="mt-2 max-w-xl text-sm text-ink-soft">
        Find replies to listings you posted or responded to. These replies
        are not end-to-end encrypted. Agnus Dei can read them for safety
        and fraud reviews. They do not create Locuto contacts.
      </p>

      {conversations.length === 0 ? (
        <Card className="mt-8 text-sm text-ink-soft">
          No replies yet. Browse the Exchange or post a listing to get started.{" "}
          <Link href="/exchange" className="underline">
            Browse the Exchange.
          </Link>
        </Card>
      ) : (
        <ul className="mt-8 space-y-6">
          {conversations.map((conversation) => (
            <ConversationCard
              key={conversation.listingId}
              conversation={conversation}
              accountId={accountId}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
