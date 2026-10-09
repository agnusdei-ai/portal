/**
 * Where a completed sign-in goes (spec art_ztdch8TP, "Sign-in behavior" and
 * "Challenge at sign-in"). Pure, so the route handler stays glue and the
 * routing decision is testable.
 */

/**
 * The `next` parameter is only ever honored as a path inside this app. A
 * signed-out link to a protected page is the intended carrier; anything else
 * (absolute URLs, protocol-relative, empty) falls back to the portal.
 */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/portal";
}

export function callbackTarget(args: {
  sessionEstablished: boolean;
  challengeRequired: boolean;
  next: string;
}): string {
  if (!args.sessionEstablished) return "/login?error=link_expired";
  if (args.challengeRequired) {
    return `/auth/mfa?next=${encodeURIComponent(args.next)}`;
  }
  return args.next;
}
