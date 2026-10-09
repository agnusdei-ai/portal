"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { Alert, Button, Card, Field, Input } from "@/components/ui";
import type { Provider } from "@supabase/supabase-js";

/** Supabase's Microsoft entry point is the `azure` provider. */
const PROVIDERS: { id: Provider; label: string }[] = [
  { id: "google", label: "Continue with Google" },
  { id: "azure", label: "Continue with Microsoft" },
  { id: "github", label: "Continue with GitHub" },
];

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/portal";
  const isSignup = params.get("mode") === "signup";
  const expired = params.get("expired") === "1";
  const callbackError = params.get("error");

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(
    callbackError ? "That sign-in link has expired or was already used. Start again." : null,
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    const supabase = createClient();
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ?? (typeof window !== "undefined" ? window.location.origin : "");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (error) {
      setError(error.message);
      setStatus("idle");
      return;
    }
    setStatus("sent");
  }

  async function signInWith(provider: Provider) {
    setError(null);
    const supabase = createClient();
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ?? (typeof window !== "undefined" ? window.location.origin : "");

    // The callback route exchanges the PKCE code, routes an enrolled factor
    // to the challenge, and only then continues to `next`.
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) setError(error.message);
  }

  return (
    <Card className="w-full max-w-sm p-8">
      <h1 className="text-2xl font-semibold">
        {isSignup ? "Start with Bede" : "Sign in"}
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        {status === "sent"
          ? "Check your email for a sign-in link."
          : "We'll email you a link — no password to remember."}
      </p>

      {expired && status !== "sent" ? (
        <div className="mt-4">
          <Alert>
            You were signed out after a period of inactivity. This is deliberate:
            the portal reaches an adults-only space, so it does not stay open.
          </Alert>
        </div>
      ) : null}

      {status !== "sent" ? (
        <>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            {error ? <Alert>{error}</Alert> : null}
            <Field label="Email">
              <Input
                type="email"
                name="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </Field>
            <Button type="submit" className="w-full" disabled={status === "sending"}>
              {status === "sending" ? "Sending…" : "Email me a link"}
            </Button>
          </form>

          <div className="mt-6">
            <div className="flex items-center gap-3 text-xs text-ink-faint">
              <span className="h-px flex-1 bg-rule" />
              or continue with
              <span className="h-px flex-1 bg-rule" />
            </div>
            <div className="mt-3 space-y-2">
              {PROVIDERS.map((p) => (
                <Button
                  key={p.id}
                  variant="secondary"
                  className="w-full"
                  onClick={() => signInWith(p.id)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
        </>
      ) : null}

      <p className="mt-6 text-xs text-ink-faint">
        Browsing{" "}
        <Link href="/curriculum" className="underline">
          curriculum
        </Link>{" "}
        and{" "}
        <Link href="/coops" className="underline">
          co-ops
        </Link>{" "}
        never requires an account.
      </p>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
