"use client";

import { useEffect, useRef, useState } from "react";

import { isUnread } from "@/lib/inbox/conversations";

/**
 * Read state lives in the browser, not the database — the inbox adds no
 * tables, and "which replies has this browser looked at" is not account data
 * worth storing. A conversation with an incoming reply newer than this
 * browser's last inbox visit shows the badge; only the inbox page marks
 * conversations seen (`markRead`), so a preview elsewhere can flag new
 * activity without swallowing it.
 */
const SEEN_KEY = "portal.inbox.seen";

function readSeen(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
    return {};
  } catch {
    // Corrupt or unreadable storage reads as "nothing seen" — a lost badge,
    // never a lost reply.
    return {};
  }
}

export function UnreadBadge({
  conversationId,
  latestIncomingAt,
  markRead = false,
}: {
  conversationId: string;
  latestIncomingAt: string | null;
  markRead?: boolean;
}) {
  const [unread, setUnread] = useState(false);
  // The decision is made once per mount, from the stored state as it was
  // before this visit — React's double effect invocation must not mark the
  // conversation seen and then judge it by the mark it just wrote.
  const resolved = useRef(false);

  useEffect(() => {
    if (resolved.current || !latestIncomingAt) return;
    resolved.current = true;

    const seen = readSeen();
    setUnread(isUnread(latestIncomingAt, seen[conversationId] ?? null));

    if (markRead) {
      seen[conversationId] = new Date().toISOString();
      window.localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
    }
  }, [conversationId, latestIncomingAt, markRead]);

  if (!unread) return null;
  return (
    <span className="inline-flex items-center rounded-full bg-brand-tint px-2 py-0.5 text-xs font-medium text-brand ring-1 ring-inset ring-brand/25">
      New
    </span>
  );
}
