// Pure, so the policy is tested as written rather than through a browser.

const origin = (url: string | undefined) => {
  try {
    return url ? new URL(url).origin : null;
  } catch {
    return null;
  }
};

/**
 * Nonce-based, with 'strict-dynamic': Next's own scripts carry the nonce, and
 * scripts they insert (the DocV SDK) are trusted through them. No inline
 * script runs without the nonce. Dev needs eval for React refresh.
 */
export function contentSecurityPolicy(nonce: string, dev: boolean): string {
  const supabase = origin(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const socure = origin(process.env.NEXT_PUBLIC_SOCURE_DOCV_SDK_URL);
  const connect = ["'self'", supabase, supabase?.replace(/^https:/, "wss:"), socure].filter(Boolean);
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "font-src 'self'",
    `connect-src ${connect.join(" ")}`,
    `frame-src ${socure ?? "'none'"}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    // A server action redirects the parent to the processor's hosted checkout.
    "form-action 'self' https://checkout.stripe.com",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

/**
 * A state-changing request must come from the site itself. Webhooks are
 * exempt: the processor and identity vendor sign them, and send no Origin.
 */
export function originAllowed(method: string, pathname: string, requestOrigin: string | null, siteOrigin: string): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return true;
  if (pathname.startsWith("/api/webhooks/")) return true;
  return requestOrigin === siteOrigin;
}
