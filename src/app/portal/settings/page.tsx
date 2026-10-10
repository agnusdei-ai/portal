import { redirect } from "next/navigation";

import { TotpEnroll } from "@/components/auth/TotpEnroll";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/portal/settings");

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const enrolled = (factors?.all ?? []).some(
    (f) => f.factor_type === "totp" && f.status === "verified",
  );

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-semibold">Settings</h1>

      <h2 className="mt-10 text-lg font-medium">Extra sign-in security</h2>
      <p className="mt-1 max-w-xl text-sm text-ink-soft">
        Use an authenticator app for an extra check when you sign in.
        Once enabled, you will need its six-digit code for protected Exchange actions.
      </p>
      <Card className="mt-4">
        <TotpEnroll initiallyEnrolled={enrolled} />
      </Card>
    </div>
  );
}
