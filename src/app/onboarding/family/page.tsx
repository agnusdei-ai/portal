import { getFamily, requireUser } from "@/lib/onboarding/queries";
import { FamilyForm } from "@/components/onboarding/family-form";
import { StepShell } from "@/components/onboarding/step-shell";

export default async function FamilyStep() {
  await requireUser();
  const family = await getFamily();

  return (
    <StepShell
      title="Your family"
      intro="Two things Bede needs before anything else: what to call your school, and which state's recordkeeping rules apply."
    >
      <FamilyForm family={family} />
    </StepShell>
  );
}
