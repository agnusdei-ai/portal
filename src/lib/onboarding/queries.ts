import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Coop, Curriculum, Family, Student, StudentCurriculum } from "@/lib/types";

export interface StudentWithBindings extends Student {
  bindings: (StudentCurriculum & { curriculum: Curriculum | null })[];
}

export interface OnboardingState {
  family: Family | null;
  students: StudentWithBindings[];
  coop: Coop | null;
}

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
}

/** The family the signed-in user belongs to. Null before the first step. */
export async function getFamily(): Promise<Family | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("families")
    .select("*, family_members!inner(user_id)")
    .eq("family_members.user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const { family_members: _members, ...family } = data as Family & {
    family_members: unknown;
  };
  return family;
}

export async function getOnboardingState(): Promise<OnboardingState> {
  const family = await getFamily();
  if (!family) return { family: null, students: [], coop: null };

  const supabase = await createClient();

  const [{ data: students }, { data: memberships }] = await Promise.all([
    supabase
      .from("students")
      .select("*, student_curricula(*, curricula(*))")
      .eq("family_id", family.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("coop_memberships")
      .select("coops(*)")
      .eq("family_id", family.id)
      .eq("status", "active")
      .limit(1),
  ]);

  const shaped: StudentWithBindings[] = (students ?? []).map((s) => {
    const { student_curricula, ...student } = s as Student & {
      student_curricula: (StudentCurriculum & { curricula: Curriculum | null })[];
    };
    return {
      ...student,
      bindings: (student_curricula ?? []).map(({ curricula, ...b }) => ({
        ...b,
        curriculum: curricula,
      })),
    };
  });

  const coop =
    (memberships?.[0] as { coops: Coop } | undefined)?.coops ?? null;

  return { family, students: shaped, coop };
}

export interface CoopCourse extends Curriculum {
  grade_level: string | null;
}

/** The shared course list a co-op publishes, flattened for display. */
export async function getCoopCourses(coopId: string): Promise<CoopCourse[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("coop_curricula")
    .select("grade_level, curricula(*)")
    .eq("coop_id", coopId);

  return ((data ?? []) as unknown as { grade_level: string | null; curricula: Curriculum | null }[])
    .filter((row) => row.curricula !== null)
    .map((row) => ({ ...(row.curricula as Curriculum), grade_level: row.grade_level }));
}

export async function searchCurricula(query: string, subject?: string) {
  const supabase = await createClient();
  let q = supabase.from("curricula").select("*").order("title").limit(25);

  if (query) q = q.or(`title.ilike.%${query}%,publisher.ilike.%${query}%`);
  if (subject) q = q.eq("subject", subject);

  const { data } = await q;
  return (data ?? []) as Curriculum[];
}

export async function listCurricula(filters: { subject?: string; philosophy?: string } = {}) {
  const supabase = await createClient();
  let q = supabase.from("curricula").select("*").order("publisher").order("title");
  if (filters.subject) q = q.eq("subject", filters.subject);
  if (filters.philosophy) q = q.eq("philosophy", filters.philosophy);
  const { data } = await q;
  return (data ?? []) as Curriculum[];
}

export async function listCoops(filters: { state?: string } = {}) {
  const supabase = await createClient();
  let q = supabase.from("coops").select("*").eq("is_listed", true).order("name");
  if (filters.state) q = q.eq("state_code", filters.state.toUpperCase());
  const { data } = await q;
  return (data ?? []) as Coop[];
}
