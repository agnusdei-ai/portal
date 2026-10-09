import type { Listing, ListingReply } from "@/lib/types";

/**
 * The inbox's one job: take exactly the replies row-level security returned —
 * "reply visible to the two parties" (0001_zones.sql) makes the read the whole
 * permission system — and gather them into conversations threaded by listing.
 * Nothing here filters by participant axis, because the axis is enforced where
 * it belongs, at the write (migration 0002's trigger); what RLS returns is
 * what renders.
 *
 * Import-free by design: the tests load this module directly through
 * tests/helpers.mjs, so grouping and unread stay pinned without a build step.
 */

/** How a conversation relates to the signed-in account. */
export type ConversationRole = "owner" | "sender" | "owner_and_sender";

export type Conversation = {
  /** Replies thread by listing; the listing id is the conversation key. */
  listingId: string;
  /**
   * Null when the listing row is no longer readable — an own reply on an
   * expired listing stays visible to its author through the sender branch of
   * the RLS policy, but the expired listing itself does not (only active
   * listings are selectable, and the owner has no exception to that).
   */
  listing: Listing | null;
  role: ConversationRole;
  /** Oldest first: a thread reads top to bottom. */
  replies: ListingReply[];
  latestReplyAt: string | null;
  /**
   * The newest reply that is not the reader's own. The only kind of reply
   * "unread" can mean — your own replies do not wait for you to read them.
   */
  latestIncomingAt: string | null;
};

export function buildConversations(
  replies: ListingReply[],
  listings: Listing[],
  accountId: string,
): Conversation[] {
  const byListing = new Map<string, Listing>();
  for (const listing of listings) {
    byListing.set(listing.id, listing);
  }

  const groups = new Map<string, ListingReply[]>();
  for (const reply of replies) {
    const group = groups.get(reply.listing_id) ?? [];
    group.push(reply);
    groups.set(reply.listing_id, group);
  }

  const conversations: Conversation[] = [...groups].map(([listingId, group]) => {
    const ordered = [...group].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const incoming = ordered.filter((r) => r.from_account !== accountId);
    const isOwner = byListing.get(listingId)?.posted_by_account === accountId;
    const isSender = ordered.some((r) => r.from_account === accountId);
    const role: ConversationRole =
      isOwner && isSender ? "owner_and_sender" : isOwner ? "owner" : "sender";

    return {
      listingId,
      listing: byListing.get(listingId) ?? null,
      role,
      replies: ordered,
      latestReplyAt: ordered[ordered.length - 1]?.created_at ?? null,
      latestIncomingAt: incoming[incoming.length - 1]?.created_at ?? null,
    };
  });

  // Newest activity first — an inbox, not an archive.
  return conversations.sort((a, b) =>
    (b.latestReplyAt ?? "").localeCompare(a.latestReplyAt ?? ""),
  );
}

/**
 * A conversation is unread when an incoming reply arrived after this browser
 * last had the conversation on screen. A conversation never opened shows no
 * badge — its content is on screen the first time, which is what reading is.
 * Read state lives in the browser (localStorage), not the database: the spec
 * gives the inbox no new tables, and "which replies has this browser seen" is
 * not account data worth storing.
 */
export function isUnread(
  latestIncomingAt: string | null,
  lastSeenAt: string | null,
): boolean {
  if (!latestIncomingAt) return false;
  if (!lastSeenAt) return false;
  return new Date(latestIncomingAt).getTime() > new Date(lastSeenAt).getTime();
}

/**
 * Timestamps render pinned to UTC: the server renders them and the browser
 * never re-renders them, so a zone-sensitive format would only promise a
 * locality it cannot know. Deterministic, and testable for the same reason.
 */
export function formatStamp(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
