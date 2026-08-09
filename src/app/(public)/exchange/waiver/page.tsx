import { redirect } from "next/navigation";

import { WAIVER } from "@/lib/consent/waiver";
import { createClient } from "@/lib/supabase/server";
import { WaiverForm } from "@/components/exchange/waiver-form";
import { ConsentDocumentView } from "@/components/consent-document";

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
    <ConsentDocumentView
      title="Before you use the exchange"
      doc={WAIVER}
      footnote={`Version ${WAIVER.version}. This is not the parental consent you gave for your child, and accepting it changes nothing about that.`}
    >
      <WaiverForm />
    </ConsentDocumentView>
  );
}
