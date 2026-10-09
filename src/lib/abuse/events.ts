/**
 * The abuse record (spec art_ztdch8TP, "Layer 3 — termination and the
 * record").
 *
 * Every refusal the detection layers make ends in one row here: the action
 * was blocked, or the session was terminated, and the operator can see which
 * and why. The table the row lands in is account-scoped by design — no IP
 * column, no payload copy — so the record shows who did it, never where they
 * came from or the text they sent.
 *
 * Import-free on purpose, like the other decision modules: the tests execute
 * these functions with a mocked admin client, so the row shape and the error
 * handling are pinned rather than assumed. `AdminClient` describes the slice
 * of the Supabase service client these paths use; the real client is
 * constructed at the call site.
 */

export type AbuseKind = "crypto_solicitation" | "rate_limit" | "automated_traffic";

export type AbuseAction = "blocked" | "session_terminated";

/** The slice of the Supabase service client the abuse paths use. */
export type AdminClient = {
  auth: {
    admin: {
      signOut: (sessionId: string) => PromiseLike<{ error: { message: string } | null }>;
    };
  };
  from: (table: string) => {
    insert: (row: Record<string, unknown>) => PromiseLike<{
      error: { message: string } | null;
    }>;
  };
};

export type AbuseEventInput = {
  accountId: string | null;
  kind: AbuseKind;
  action: AbuseAction;
  detail?: Record<string, unknown>;
};

/**
 * Writes one abuse event under the service role. The failures, if any, come
 * back as strings for the caller to surface — the record must never be the
 * thing that breaks the user-facing path, but a failure must not vanish
 * either.
 */
export async function recordAbuseEvent(
  admin: AdminClient,
  event: AbuseEventInput,
): Promise<string[]> {
  const { error } = await admin.from("abuse_events").insert({
    account_id: event.accountId,
    kind: event.kind,
    action: event.action,
    detail: event.detail ?? {},
  });
  return error ? [`abuse_events insert failed: ${error.message}`] : [];
}
