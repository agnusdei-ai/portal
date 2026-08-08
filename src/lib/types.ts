/**
 * Hand-maintained mirror of supabase/migrations. Regenerate with:
 *   npx supabase gen types typescript --linked > src/lib/types.ts
 * once the project is linked; until then this keeps the app type-checked.
 */

export type OnboardingStep =
  | "family"
  | "students"
  | "curriculum"
  | "coop"
  | "review"
  | "complete";

export type BedeSupport = "native" | "assisted" | "unsupported";
export type CurriculumSource = "family" | "coop";
export type HandoffStatus = "pending" | "sent" | "failed";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
}

export type Family = {
  id: string;
  name: string;
  owner_id: string;
  state_code: string | null;
  school_year: string | null;
  onboarding_step: OnboardingStep;
  onboarding_completed_at: string | null;
  created_at: string;
}

export type Student = {
  id: string;
  family_id: string;
  first_name: string;
  birth_year: number | null;
  grade_level: string;
  notes: string | null;
  created_at: string;
}

export type Curriculum = {
  id: string;
  slug: string;
  title: string;
  publisher: string;
  subject: string;
  grade_min: string | null;
  grade_max: string | null;
  philosophy: string | null;
  description: string | null;
  bede_support: BedeSupport;
  created_at: string;
}

export type Coop = {
  id: string;
  slug: string;
  name: string;
  state_code: string | null;
  region: string | null;
  description: string | null;
  meeting_day: string | null;
  join_code: string;
  director_id: string | null;
  is_listed: boolean;
  created_at: string;
}

export type StudentCurriculum = {
  id: string;
  student_id: string;
  curriculum_id: string | null;
  custom_title: string | null;
  subject: string;
  source: CurriculumSource;
  coop_id: string | null;
  created_at: string;
}

export type BedeHandoff = {
  id: string;
  family_id: string;
  status: HandoffStatus;
  payload: unknown;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

export type FamilyMember = {
  family_id: string;
  user_id: string;
  role: string;
  created_at: string;
}

export type CoopMembership = {
  coop_id: string;
  family_id: string;
  role: string;
  status: string;
  created_at: string;
}

export type CoopCurriculum = {
  coop_id: string;
  curriculum_id: string;
  grade_level: string | null;
}

/**
 * Writes go through Partial<Row> rather than precise Insert types. Defaults and
 * generated columns live in the migration, and the server actions validate with
 * Zod before they get here, so this trades a little insert-time strictness for
 * a type file that stays readable until codegen replaces it.
 */
type Table<Row, Rels extends Relationship[] = []> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: Rels;
};

/**
 * Foreign keys, declared so embedded selects (`students(*, student_curricula(*))`)
 * type-check. Without these, postgrest-js can't resolve the join and the embed
 * comes back as a SelectQueryError instead of rows.
 */
type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type FK<Column extends string, Referenced extends string> = {
  foreignKeyName: `${string}_${Column}_fkey`;
  columns: [Column];
  isOneToOne: false;
  referencedRelation: Referenced;
  referencedColumns: ["id"];
};

/**
 * Must satisfy supabase-js's GenericSchema — Views, Functions, Enums, and
 * CompositeTypes are all required, and every query silently resolves to `never`
 * without them.
 */
export interface Database {
  public: {
    Tables: {
      profiles: Table<Profile>;
      curricula: Table<Curriculum>;
      families: Table<Family, [FK<"owner_id", "profiles">]>;
      students: Table<Student, [FK<"family_id", "families">]>;
      coops: Table<Coop, [FK<"director_id", "profiles">]>;
      bede_handoffs: Table<BedeHandoff, [FK<"family_id", "families">]>;
      family_members: Table<
        FamilyMember,
        [FK<"family_id", "families">, FK<"user_id", "profiles">]
      >;
      student_curricula: Table<
        StudentCurriculum,
        [
          FK<"student_id", "students">,
          FK<"curriculum_id", "curricula">,
          FK<"coop_id", "coops">,
        ]
      >;
      coop_memberships: Table<
        CoopMembership,
        [FK<"coop_id", "coops">, FK<"family_id", "families">]
      >;
      coop_curricula: Table<
        CoopCurriculum,
        [FK<"coop_id", "coops">, FK<"curriculum_id", "curricula">]
      >;
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      onboarding_step: OnboardingStep;
      bede_support: BedeSupport;
      curriculum_source: CurriculumSource;
      handoff_status: HandoffStatus;
      family_role: "owner" | "parent" | "viewer";
      coop_role: "director" | "member";
      membership_status: "pending" | "active" | "removed";
    };
    CompositeTypes: { [_ in never]: never };
  };
}
