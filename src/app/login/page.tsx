"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { Alert, Button, Card, Field, Input } from "@/components/ui";

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/onboarding";
  const isSignup = params.get("mode") === "signup";

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

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

      {status !== "sent" ? (
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
