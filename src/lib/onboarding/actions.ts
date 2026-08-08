"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { buildHandoffPayload, sendToBede } from "@/lib/bede/handoff";
import { getFamily, getOnboardingState } from "@/lib/onboarding/queries";
import { nextStep, resumePath, stepIndex } from "@/lib/onboarding/steps";
import {
  bindingSchema,
  familySchema,
  joinCoopSchema,
  studentSchema,
  toFieldErrors,
  type ActionState,
} from "@/lib/onboarding/schema";
import type { OnboardingStep } from "@/lib/types";

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user.id;
}

/**
 * Advances the recorded step, never rewinds it. A parent revisiting step 2
 * after reaching step 4 shouldn't lose their place.
 */
async function advance(familyId: string, from: Exclude<OnboardingStep, "complete">) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("families")
    .select("onboarding_step")
    .eq("id", familyId)
    .single();

  const target = nextStep(from);
  const current = (data?.onboarding_step ?? "family") as OnboardingStep;

  if (stepIndex(target) > stepIndex(current)) {
    await supabase.from("families").update({ onboarding_step: target }).eq("id", familyId);
  }
  return target;
}

export async function saveFamily(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = familySchema.safeParse({
    name: formData.get("name"),
    state_code: formData.get("state_code"),
    school_year: formData.get("school_year"),
  });
  if (!parsed.success) return toFieldErrors(parsed.error);

  const userId = await requireUserId();
  const supabase = await createClient();
  const existing = await getFamily();

  let familyId: string;

  if (existing) {
    const { error } = await supabase
      .from("families")
      .update(parsed.data)
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
    familyId = existing.id;
  } else {
    const { data, error } = await supabase
      .from("families")
      .insert({ ...parsed.data, owner_id: userId })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Could not create family." };
    familyId = data.id;

    // The insert policy on families checks owner_id, but every read policy goes
    // through family_members — so the owner must be enrolled immediately or
    // they lose access to the row they just created.
    const { error: memberError } = await supabase
      .from("family_members")
      .insert({ family_id: familyId, user_id: userId, role: "owner" });
    if (memberError) return { ok: false, error: memberError.message };
  }

  await advance(familyId, "family");
  revalidatePath("/onboarding", "layout");
  redirect("/onboarding/students");
}

export async function addStudent(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = studentSchema.safeParse({
    first_name: formData.get("first_name"),
    grade_level: formData.get("grade_level"),
    birth_year: formData.get("birth_year") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return toFieldErrors(parsed.error);

  const family = await getFamily();
  if (!family) return { ok: false, error: "Finish the first step before adding students." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("students")
    .insert({ ...parsed.data, family_id: family.id });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/onboarding/students");
  return { ok: true };
}

export async function removeStudent(formData: FormData): Promise<void> {
  const id = String(formData.get("student_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("students").delete().eq("id", id);
  revalidatePath("/onboarding/students");
}

export async function finishStudents(): Promise<void> {
  const { family, students } = await getOnboardingState();
  if (!family) redirect("/onboarding/family");
  if (students.length === 0) return; // UI disables the button; this is the backstop.

  await advance(family.id, "students");
  revalidatePath("/onboarding", "layout");
  redirect("/onboarding/curriculum");
}

export async function addBinding(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = bindingSchema.safeParse({
    student_id: formData.get("student_id"),
    subject: formData.get("subject"),
    curriculum_id: formData.get("curriculum_id") ?? "",
    custom_title: formData.get("custom_title") ?? "",
  });
  if (!parsed.success) return toFieldErrors(parsed.error);

  const supabase = await createClient();
  const { student_id, subject, curriculum_id, custom_title } = parsed.data;

  const { error } = await supabase.from("student_curricula").insert({
    student_id,
    subject,
    // A catalog pick wins; the free-text box is only recorded when nothing was
    // selected, so we never store a stale title beside a real curriculum id.
    curriculum_id: curriculum_id || null,
    custom_title: curriculum_id ? null : custom_title || null,
    source: "family",
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/onboarding/curriculum");
  return { ok: true };
}

export async function removeBinding(formData: FormData): Promise<void> {
  const id = String(formData.get("binding_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("student_curricula").delete().eq("id", id);
  revalidatePath("/onboarding/curriculum");
}

export async function finishCurriculum(): Promise<void> {
  const { family, students } = await getOnboardingState();
  if (!family) redirect("/onboarding/family");

  const everyStudentHasOne = students.every((s) => s.bindings.length > 0);
  if (!everyStudentHasOne) return;

  await advance(family.id, "curriculum");
  revalidatePath("/onboarding", "layout");
  redirect("/onboarding/coop");
}

export async function joinCoop(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = joinCoopSchema.safeParse({ join_code: formData.get("join_code") });
  if (!parsed.success) return toFieldErrors(parsed.error);

  const family = await getFamily();
  if (!family) return { ok: false, error: "Finish the earlier steps first." };

  const supabase = await createClient();
  const { data: coop } = await supabase
    .from("coops")
    .select("id")
    .eq("join_code", parsed.data.join_code)
    .maybeSingle();

  if (!coop) {
    return { ok: false, fieldErrors: { join_code: ["No co-op uses that code."] } };
  }

  const { error } = await supabase
    .from("coop_memberships")
    .upsert(
      { coop_id: coop.id, family_id: family.id, role: "member", status: "active" },
      { onConflict: "coop_id,family_id" },
    );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/onboarding/coop");
  return { ok: true };
}

export async function leaveCoop(formData: FormData): Promise<void> {
  const coopId = String(formData.get("coop_id") ?? "");
  const family = await getFamily();
  if (!coopId || !family) return;

  const supabase = await createClient();
  await supabase
    .from("coop_memberships")
    .delete()
    .eq("coop_id", coopId)
    .eq("family_id", family.id);
  revalidatePath("/onboarding/coop");
}

/**
 * Adds one of the co-op's shared courses to a child. Recorded with source
 * 'coop' so Bede defers to the co-op's pacing instead of planning its own.
 */
export async function adoptCoopCourse(formData: FormData): Promise<void> {
  const studentId = String(formData.get("student_id") ?? "");
  const curriculumId = String(formData.get("curriculum_id") ?? "");
  const subject = String(formData.get("subject") ?? "");
  const coopId = String(formData.get("coop_id") ?? "");
  if (!studentId || !curriculumId || !subject) return;

  const supabase = await createClient();
  await supabase.from("student_curricula").insert({
    student_id: studentId,
    curriculum_id: curriculumId,
    subject,
    source: "coop",
    coop_id: coopId || null,
  });
  revalidatePath("/onboarding/coop");
  revalidatePath("/onboarding/curriculum");
}

export async function finishCoop(): Promise<void> {
  const family = await getFamily();
  if (!family) redirect("/onboarding/family");

  await advance(family.id, "coop");
  revalidatePath("/onboarding", "layout");
  redirect("/onboarding/review");
}

/**
 * Terminal step: freeze the payload, hand it to Bede, and only mark onboarding
 * complete if Bede accepted it. A failed handoff leaves the family on /review
 * with a retryable error rather than a portal that looks provisioned but isn't.
 */
export async function completeOnboarding(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const { family, students, coop } = await getOnboardingState();
  if (!family) redirect("/onboarding/family");

  if (students.length === 0) {
    return { ok: false, error: "Add at least one student before finishing." };
  }
  if (!students.every((s) => s.bindings.length > 0)) {
    return { ok: false, error: "Every student needs at least one course." };
  }

  const payload = buildHandoffPayload({ family, coop, students });
  const supabase = await createClient();

  const { data: handoff, error: insertError } = await supabase
    .from("bede_handoffs")
    .insert({ family_id: family.id, payload, status: "pending" })
    .select("id")
    .single();
  if (insertError || !handoff) {
    return { ok: false, error: insertError?.message ?? "Could not record the handoff." };
  }

  const result = await sendToBede(payload);

  await supabase
    .from("bede_handoffs")
    .update({
      status: result.ok ? "sent" : "failed",
      error: result.error ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", handoff.id);

  if (!result.ok) {
    return { ok: false, error: `Bede couldn't be set up: ${result.error}` };
  }

  await supabase
    .from("families")
    .update({
      onboarding_step: "complete",
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq("id", family.id);

  revalidatePath("/", "layout");
  redirect("/dashboard?welcome=1");
}

/** Used by the wizard layout to bounce anyone who deep-links past their place. */
export async function guardStep(target: Exclude<OnboardingStep, "complete">) {
  const family = await getFamily();
  if (!family) {
    if (target !== "family") redirect("/onboarding/family");
    return null;
  }
  if (stepIndex(target) > stepIndex(family.onboarding_step)) {
    redirect(resumePath(family.onboarding_step));
  }
  return family;
}
