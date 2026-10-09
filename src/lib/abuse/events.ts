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

export type TerminationInput = {
  /** The session to revoke, when the caller has one. */
  sessionId: string | null;
  accountId: string | null;
  kind?: AbuseKind;
  detail?: Record<string, unknown>;
};

export type TerminationResult = {
  /** Whether a live session was found and revoked. */
  revoked: boolean;
  /** Whether the abuse_events row was written. */
  recorded: boolean;
  /** Every failure, for the caller to surface — none are swallowed here. */
  errors: string[];
};

/**
 * Terminates an abusive caller: revokes the session through the Supabase
 * admin API and records the event (spec art_ztdch8TP, "Layer 3"). The record
 * is written even when the revocation fails, and the action is honest about
 * what happened — a session that could not be revoked is recorded as
 * `blocked`, because `session_terminated` would be a claim the record cannot
 * support.
 */
export async function terminateAbusiveSession(
  admin: AdminClient,
  input: TerminationInput,
): Promise<TerminationResult> {
  const errors: string[] = [];
  let revoked = false;

  if (input.sessionId) {
    const { error } = await admin.auth.admin.signOut(input.sessionId);
    if (error) {
      errors.push(`session ${input.sessionId} could not be revoked: ${error.message}`);
    } else {
      revoked = true;
    }
  }

  const insertErrors = await recordAbuseEvent(admin, {
    accountId: input.accountId,
    kind: input.kind ?? "rate_limit",
    action: revoked ? "session_terminated" : "blocked",
    detail: input.detail,
  });
  errors.push(...insertErrors);

  return { revoked, recorded: insertErrors.length === 0, errors };
}

/**
 * The session a live access token belongs to. GoTrue access tokens carry the
 * session id as a claim, and the admin revoke is keyed by it. A token that
 * will not parse simply yields nothing to revoke — the abuse event is still
 * recorded — because an unparseable token arriving in an abusive request is
 * not trustworthy input to begin with.
 */
export function sessionIdFromAccessToken(
  accessToken: string | null | undefined,
): string | null {
  if (!accessToken) return null;

  const parts = accessToken.split(".");
  if (parts.length !== 3) return null;

  try {
    // JWTs are base64url; atob wants padded base64.
    const base64 = parts[1].replaceAll("-", "+").replaceAll("_", "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { session_id?: unknown };
    return typeof payload.session_id === "string" ? payload.session_id : null;
  } catch {
    return null;
  }
}
