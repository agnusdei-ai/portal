import test from "node:test";
import assert from "node:assert/strict";

import { loadModule } from "./helpers.mjs";

/**
 * The inbox's grouping and unread rules, pinned as pure functions. The RLS
 * test (inbox-rls.test.mjs) proves what the database returns; this one proves
 * that what renders from it is threaded, ordered, and unread-honest.
 */
const { buildConversations, isUnread, formatStamp } = loadModule(
  new URL("../src/lib/inbox/conversations.ts", import.meta.url),
);

const READER = "aaaaaaaa-0000-0000-0000-000000000001";
const OTHER = "aaaaaaaa-0000-0000-0000-000000000002";

function reply(id, listingId, from, createdAt) {
  return { id, listing_id: listingId, from_account: from, body: `body ${id}`, created_at: createdAt };
}

function listing(id, postedBy) {
  return {
    id,
    category: "materials",
    title: `Listing ${id}`,
    body: "…",
    state_code: "TX",
    region: "Austin",
    posted_by_account: postedBy,
    posted_as: "parent",
    state: "active",
    expires_at: "2026-11-01T00:00:00Z",
    created_at: "2026-10-01T00:00:00Z",
  };
}

test("replies thread by listing, oldest first, conversations newest-first", () => {
  const listingA = listing("listing-a", OTHER);
  const listingB = listing("listing-b", READER);
  const conversations = buildConversations(
    [
      reply("r3", "listing-b", OTHER, "2026-10-09T10:00:00Z"),
      reply("r1", "listing-a", READER, "2026-10-08T10:00:00Z"),
      reply("r2", "listing-a", OTHER, "2026-10-08T11:00:00Z"),
    ],
    [listingA, listingB],
    READER,
  );

  assert.deepEqual(
    conversations.map((c) => c.listingId),
    ["listing-b", "listing-a"],
    "the conversation with the newest reply leads",
  );

  const [ownerThread] = conversations;
  assert.deepEqual(
    ownerThread.replies.map((r) => r.id),
    ["r3"],
  );

  const repliedThread = conversations[1];
  assert.deepEqual(
    repliedThread.replies.map((r) => r.id),
    ["r1", "r2"],
    "a thread reads top to bottom",
  );
});

test("role reflects the reader's relation to each conversation", () => {
  const listingA = listing("listing-a", OTHER); // reader replied here
  const listingB = listing("listing-b", READER); // reader owns this
  const listingC = listing("listing-c", READER); // reader owns and has replied
  const conversations = buildConversations(
    [
      reply("r1", "listing-a", READER, "2026-10-08T10:00:00Z"),
      reply("r2", "listing-b", OTHER, "2026-10-08T11:00:00Z"),
      reply("r3", "listing-c", OTHER, "2026-10-08T12:00:00Z"),
      reply("r4", "listing-c", READER, "2026-10-08T13:00:00Z"),
    ],
    [listingA, listingB, listingC],
    READER,
  );

  const byId = new Map(conversations.map((c) => [c.listingId, c]));
  assert.equal(byId.get("listing-a").role, "sender");
  assert.equal(byId.get("listing-b").role, "owner");
  assert.equal(byId.get("listing-c").role, "owner_and_sender");
});

test("an own reply whose listing is no longer readable still renders, without a link", () => {
  // Only active listings are selectable — the owner has no exception — so the
  // listing row can be missing while the reader's own reply remains visible.
  const conversations = buildConversations(
    [reply("r1", "listing-gone", READER, "2026-10-08T10:00:00Z")],
    [], // the listings lookup returned nothing for this id
    READER,
  );

  assert.equal(conversations.length, 1);
  assert.equal(conversations[0].listing, null);
  assert.equal(conversations[0].role, "sender");
});

test("unread means an incoming reply newer than the browser's last look", () => {
  assert.equal(isUnread("2026-10-09T10:00:00Z", "2026-10-09T09:00:00Z"), true);
  assert.equal(isUnread("2026-10-09T10:00:00Z", "2026-10-09T10:00:00Z"), false);
  assert.equal(isUnread("2026-10-09T10:00:00Z", "2026-10-09T11:00:00Z"), false);

  // Nothing incoming to read, or nothing ever seen: no badge either way.
  assert.equal(isUnread(null, "2026-10-09T09:00:00Z"), false);
  assert.equal(isUnread("2026-10-09T10:00:00Z", null), false);

  // A conversation containing only the reader's own replies never pings.
  const onlyMine = buildConversations(
    [reply("r1", "listing-a", READER, "2026-10-08T10:00:00Z")],
    [listing("listing-a", OTHER)],
    READER,
  );
  assert.equal(onlyMine[0].latestIncomingAt, null);
  assert.equal(isUnread(onlyMine[0].latestIncomingAt, null), false);
});

test("stamps render in a fixed locale and zone, or not at all", () => {
  assert.equal(formatStamp("2026-10-09T15:04:00Z"), "Oct 9, 3:04 PM");
  assert.equal(formatStamp(null), "");
});
