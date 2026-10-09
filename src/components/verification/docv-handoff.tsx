"use client";

import { useEffect, useRef, useState } from "react";

import { Alert, Card } from "@/components/ui";

/**
 * The DocV Web SDK is loaded from the URL the operator's Socure tenant
 * provides (DevHub integration guide); with no tenant configured the component
 * says so honestly instead of pretending capture can run. The SDK's global and
 * init options below are the one place the vendor's browser surface is
 * touched, and are confirmed against the tenant at onboarding — the spec's
 * sandbox reality check keeps the rest of the flow testable on fixtures.
 */
const SDK_URL = process.env.NEXT_PUBLIC_SOCURE_DOCV_SDK_URL;

type Phase = "loading" | "ready" | "received" | "error" | "unconfigured";

export function DocVHandoff({ token }: { token: string }) {
  const [phase, setPhase] = useState<Phase>(SDK_URL ? "loading" : "unconfigured");
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!SDK_URL) return;

    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => {
      const sdk = (
        window as {
          SocureDocV?: {
            init: (options: Record<string, unknown>) => void;
          };
        }
      ).SocureDocV;
      if (!sdk || !mountRef.current) {
        setPhase("error");
        return;
      }
      try {
        sdk.init({
          transactionToken: token,
          container: mountRef.current,
          onComplete: () => setPhase("received"),
          onError: () => setPhase("error"),
        });
        setPhase("ready");
      } catch {
        setPhase("error");
      }
    };
    script.onerror = () => setPhase("error");
    document.body.appendChild(script);
    return () => {
      script.remove();
    };
  }, [token]);

  if (phase === "unconfigured") {
    return (
      <Card>
        <h2 className="text-lg font-medium">Next: document capture</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Your details are with the verification provider. Document capture
          opens here as soon as the tenant is configured — the operator sets it
          up once, portal-wide. Nothing else is needed from you right now.
        </p>
      </Card>
    );
  }

  if (phase === "received") {
    return (
      <Card>
        <h2 className="text-lg font-medium">Documents received</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Your document is with the verification provider. When the check
          completes, this page shows the outcome — usually within minutes.
        </p>
      </Card>
    );
  }

  if (phase === "error") {
    return (
      <Alert>
        Document capture could not start. Reload the page to try again; if it
        keeps failing, contact the operator.
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-soft">
        {phase === "loading"
          ? "Starting document capture…"
          : "Have your document ready and follow the steps below."}
      </p>
      <div ref={mountRef} />
    </div>
  );
}
