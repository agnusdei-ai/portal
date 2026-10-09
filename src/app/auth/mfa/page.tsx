"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/auth/callback";
import { Alert, Button, ButtonLink, Card, Field, Input } from "@/components/ui";

/**
 * The second-factor step at sign-in (spec art_ztdch8TP, "Challenge at
 * sign-in"). The callback route sends an AAL1 session here when a factor is
 * enrolled; verifying promotes the session to AAL2 and continues to `next`.
 * This page stays reachable at AAL1 — it is how a session gets to AAL2.
 */
function ChallengeForm() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));

  const [factorId, setFactorId] = useState<string | null>(null);
  const [status, setStatus] = useState<"starting" | "ready" | "none" | "error">("starting");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The code input takes focus when the challenge lands, not on mount.
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const supabase = createClient();
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!live) return;
      if (aal?.currentLevel === "aal2") {
        window.location.assign(next);
        return;
      }

      const { data, error } = await supabase.auth.mfa.listFactors();
      if (!live) return;
      // data.totp holds this user's verified TOTP factors only.
      const factor = data?.totp?.[0];
      if (error || !factor) {
        setStatus("none");
        return;
      }
      setFactorId(factor.id);
      setStatus("ready");
      codeRef.current?.focus();
    })();
    return () => {
      live = false;
    };
  }, [next]);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    });
    if (challengeError || !challenge) {
      setError("Could not start a verification. Try again.");
      setBusy(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });
    if (verifyError) {
      setError(
        "That code didn't match. Codes rotate every 30 seconds — check the app and try again.",
      );
      setBusy(false);
      return;
    }

    // A hard navigation: middleware must see the upgraded session.
    window.location.assign(next);
  }

  if (status === "starting") {
    return (
      <Card className="w-full max-w-sm p-8">
        <p className="text-sm text-ink-soft">Checking your second factor…</p>
      </Card>
    );
  }

  if (status === "none") {
    return (
      <Card className="w-full max-w-sm p-8">
        <h1 className="text-2xl font-semibold">No second factor</h1>
        <p className="mt-2 text-sm text-ink-soft">
          This account has no authenticator enrolled. You can continue without
          one, and set it up later in settings.
        </p>
        <Button className="mt-6 w-full" onClick={() => window.location.assign(next)}>
          Continue
        </Button>
      </Card>
    );
  }

  if (status === "error") {
    return (
      <Card className="w-full max-w-sm p-8">
        <h1 className="text-2xl font-semibold">Sign in again</h1>
        <p className="mt-2 text-sm text-ink-soft">
          We couldn&apos;t check your second factor because your session has
          ended.
        </p>
        <ButtonLink href="/login" className="mt-6 w-full">
          Back to sign-in
        </ButtonLink>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm p-8">
      <h1 className="text-2xl font-semibold">Two-factor sign-in</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Enter the 6-digit code from your authenticator app.
      </p>

      <form onSubmit={verify} className="mt-6 space-y-4">
        {error ? <Alert>{error}</Alert> : null}
        <Field label="Code">
          <Input
            ref={codeRef}
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            className="text-center text-lg tracking-[0.4em]"
          />
        </Field>
        <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>
          {busy ? "Checking…" : "Verify"}
        </Button>
      </form>
    </Card>
  );
}

export default function MfaPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <Suspense fallback={null}>
        <ChallengeForm />
      </Suspense>
    </div>
  );
}
