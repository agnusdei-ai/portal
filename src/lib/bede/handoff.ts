import type { Coop, Family, Student, StudentCurriculum, Curriculum } from "@/lib/types";

/**
 * The payload Bede is provisioned with. This is the contract between the portal
 * and Bede — the portal's entire job is to produce a correct one of these.
 */
export interface BedeHandoffPayload {
  version: 1;
  family: {
    id: string;
    name: string;
    state_code: string | null;
    school_year: string | null;
  };
  coop: {
    id: string;
    name: string;
    meeting_day: string | null;
  } | null;
  students: {
    id: string;
    first_name: string;
    grade_level: string;
    birth_year: number | null;
    notes: string | null;
    courses: {
      subject: string;
      /** Catalog id when Bede has an ingested scope-and-sequence for it. */
      curriculum_id: string | null;
      title: string;
      publisher: string | null;
      /** 'coop' courses follow the co-op's pacing, not the family's. */
      source: "family" | "coop";
      bede_support: string | null;
    }[];
  }[];
}

interface BuildArgs {
  family: Family;
  coop: Coop | null;
  students: (Student & {
    bindings: (StudentCurriculum & { curriculum: Curriculum | null })[];
  })[];
}

export function buildHandoffPayload({ family, coop, students }: BuildArgs): BedeHandoffPayload {
  return {
    version: 1,
    family: {
      id: family.id,
      name: family.name,
      state_code: family.state_code,
      school_year: family.school_year,
    },
    coop: coop
      ? { id: coop.id, name: coop.name, meeting_day: coop.meeting_day }
      : null,
    students: students.map((s) => ({
      id: s.id,
      first_name: s.first_name,
      grade_level: s.grade_level,
      birth_year: s.birth_year,
      notes: s.notes,
      courses: s.bindings.map((b) => ({
        subject: b.subject,
        curriculum_id: b.curriculum_id,
        title: b.curriculum?.title ?? b.custom_title ?? "Untitled course",
        publisher: b.curriculum?.publisher ?? null,
        source: b.source,
        bede_support: b.curriculum?.bede_support ?? null,
      })),
    })),
  };
}

export interface HandoffResult {
  ok: boolean;
  error?: string;
}

/**
 * Ships the payload to Bede. With BEDE_API_URL unset the payload is still
 * recorded in bede_handoffs and treated as a success, so onboarding is testable
 * end to end before Bede's provisioning endpoint exists.
 */
export async function sendToBede(payload: BedeHandoffPayload): Promise<HandoffResult> {
  const url = process.env.BEDE_API_URL;
  if (!url) {
    console.info("[bede] BEDE_API_URL unset — recording handoff without sending");
    return { ok: true };
  }

  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/v1/provision`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.BEDE_API_KEY
          ? { authorization: `Bearer ${process.env.BEDE_API_KEY}` }
          : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      return { ok: false, error: `Bede returned ${res.status}: ${await res.text()}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
