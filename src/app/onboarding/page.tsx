import { redirect } from "next/navigation";

import { getFamily } from "@/lib/onboarding/queries";
import { resumePath } from "@/lib/onboarding/steps";

/** Entry point: drop a returning parent exactly where they left off. */
export default async function OnboardingIndex() {
  const family = await getFamily();
  redirect(family ? resumePath(family.onboarding_step) : "/onboarding/family");
}
