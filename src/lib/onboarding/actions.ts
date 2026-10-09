"use server";

import { revalidatePath } from "next/cache";

import { currentAccountId } from "@/lib/account";
import { createClient } from "@/lib/supabase/server";
import type { OnboardingChecklist, OnboardingPersona } from "@/lib/types";

import { isPersona, isSelfMarkable } from "./checklist";

/** The account's persisted checklist row, or the default when none exists. */
export async function currentOnboarding(
  accountId: string,
): Promise<Pick<OnboardingChecklist, "persona" | "marked_steps">> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("onboarding_checklists")
    .select("persona, marked_steps")
    .eq("account_id", accountId)
    .maybeSingle();

  return {
    persona: isPersona(data?.persona) ? data.persona : "parent",
    marked_steps: data?.marked_steps ?? [],
  };
}

function revalidate() {
  revalidatePath("/portal/start");
  revalidatePath("/portal");
}

export async function choosePersona(formData: FormData): Promise<void> {
  const accountId = await currentAccountId();
  if (!accountId) return;

  const persona = formData.get("persona");
  if (!isPersona(persona)) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("onboarding_checklists")
    .upsert(
      { account_id: accountId, persona },
      { onConflict: "account_id" },
    );
  if (error) {
    console.error("persona choice not saved:", error.message);
    return;
  }

  revalidate();
}

export async function markStepDone(formData: FormData): Promise<void> {
  const accountId = await currentAccountId();
  if (!accountId) return;

  const stepId = String(formData.get("stepId") ?? "");
  const { persona, marked_steps } = await currentOnboarding(accountId);

  // The honour check against a forged or stale mark: the pure module decides
  // which steps an account may mark, and nothing here can widen it.
  if (!isSelfMarkable(persona, stepId)) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("onboarding_checklists")
    .upsert(
      {
        account_id: accountId,
        persona: persona satisfies OnboardingPersona,
        marked_steps: marked_steps.includes(stepId)
          ? marked_steps
          : [...marked_steps, stepId],
      },
      { onConflict: "account_id" },
    );
  if (error) {
    console.error("step mark not saved:", error.message);
    return;
  }

  revalidate();
}
