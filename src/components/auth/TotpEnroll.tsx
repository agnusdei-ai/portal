"use client";

import { useState } from "react";
import QRCode from "qrcode";

import { createClient } from "@/lib/supabase/client";
import { Alert, Button, Field, Input } from "@/components/ui";

/**
 * TOTP second-factor enrollment (spec art_ztdch8TP, "Second factor").
 * The secret is a standard otpauth:// URI — Google, Microsoft, and Yubico
 * authenticator apps all scan the same QR code; there is no per-app build.
 */
export function TotpEnroll({
  initiallyEnrolled = false,
}: {
  /** Server-read state, so a returning enrollee sees the truth without a flash. */
  initiallyEnrolled?: boolean;
}) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrolled, setEnrolled] = useState(initiallyEnrolled);

  async function start() {
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    if (error || !data) {
      setError("Enrollment could not start. Try again in a moment.");
      setBusy(false);
      return;
    }

    setFactorId(data.id);
    setSecret(data.totp.secret);
    // Rendered locally in the browser; the secret never travels anywhere else.
    setQrDataUrl(await QRCode.toDataURL(data.totp.uri));
    setBusy(false);
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    });
    if (challengeError || !challenge) {
      setError("Verification could not start. Try again.");
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

    setEnrolled(true);
    setBusy(false);
  }

  if (enrolled) {
    return (
      <Alert>
        Two-factor sign-in is on. Every fresh sign-in will ask for a code from
        your authenticator app. Keep the app — a paid seat without its
        authenticator has no recovery path yet.
      </Alert>
    );
  }

  if (!factorId) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink-soft">
          Add a second step at sign-in: a 6-digit code from an authenticator
          app. Enrolling is prompted, not forced — the exchange works without
          it, and a recovery path comes before it ever becomes one.
        </p>
        <Button onClick={start} disabled={busy}>
          {busy ? "Starting…" : "Set up an authenticator"}
        </Button>
        {error ? <Alert>{error}</Alert> : null}
      </div>
    );
  }

  return (
    <form onSubmit={confirm} className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrDataUrl}
            alt="QR code for your authenticator app"
            className="h-40 w-40 rounded-lg bg-white p-2"
          />
        ) : null}
        <div className="text-sm text-ink-soft">
          <p>
            Scan with Google, Microsoft, or Yubico Authenticator — any app that
            scans standard codes.
          </p>
          {secret ? (
            <p className="mt-2 break-all font-mono text-xs text-ink-faint">
              or enter the key by hand: {secret}
            </p>
          ) : null}
        </div>
      </div>
      {error ? <Alert>{error}</Alert> : null}
      <Field label="Enter the 6-digit code to confirm">
        <Input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="000000"
          className="max-w-[12rem] text-center tracking-[0.4em]"
        />
      </Field>
      <Button type="submit" disabled={busy || code.length !== 6}>
        {busy ? "Checking…" : "Confirm and turn on"}
      </Button>
    </form>
  );
}
