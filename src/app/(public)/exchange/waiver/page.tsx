import { redirect } from "next/navigation";

import {
  WAIVER_LEAD,
  WAIVER_SECTIONS,
  WAIVER_VERSION,
} from "@/lib/consent/waiver";
import { createClient } from "@/lib/supabase/server";
import { WaiverForm } from "@/components/exchange/waiver-form";
import { Card } from "@/components/ui";

export default async function WaiverPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/exchange/waiver");

  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (!account) redirect("/setup");

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold">Before you use the exchange</h1>
      <p className="mt-3 font-medium text-ink">{WAIVER_LEAD}</p>

      <Card className="mt-8 space-y-6">
        {WAIVER_SECTIONS.map((section) => (
          <section key={section.heading}>
            <h2 className="font-medium text-ink">{section.heading}</h2>
            {section.body.map((paragraph, i) => (
              <p key={i} className="mt-2 text-sm leading-relaxed text-ink-soft">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </Card>

      <p className="mt-4 text-xs text-ink-faint">
        Version {WAIVER_VERSION}. This is not the parental consent you gave for
        your child, and accepting it changes nothing about that.
      </p>

      <div className="mt-8">
        <WaiverForm />
      </div>
    </div>
  );
}
