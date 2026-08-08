import { z } from "zod";

export const GRADE_LEVELS = [
  "PreK",
  "K",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
] as const;

export const SUBJECTS = [
  "Math",
  "Language Arts",
  "Science",
  "History",
  "Latin",
  "Literature",
  "Religion",
  "Logic",
  "Art",
  "Music",
  "Foreign Language",
  "Other",
] as const;

const US_STATES = /^[A-Z]{2}$/;

export const familySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Give your school a name — most families use their surname.")
    .max(80),
  state_code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(US_STATES, "Use a two-letter state code, e.g. TX."),
  school_year: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{4}$/, "Use the form 2026-2027.")
    .refine((v) => {
      const [start, end] = v.split("-").map(Number);
      return end === start + 1;
    }, "The second year should follow the first, e.g. 2026-2027."),
});

export const studentSchema = z.object({
  first_name: z.string().trim().min(1, "A first name is required.").max(60),
  grade_level: z.enum(GRADE_LEVELS, {
    errorMap: () => ({ message: "Pick a grade level." }),
  }),
  birth_year: z
    .union([z.coerce.number().int().min(1990).max(2100), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  notes: z.string().trim().max(500).optional().transform((v) => v || null),
});

/**
 * A binding is either a catalog pick or a free-text title. Parents use plenty
 * of material that isn't in the catalog, and blocking them there would strand
 * onboarding at its most important step.
 */
export const bindingSchema = z
  .object({
    student_id: z.string().uuid("Pick a student."),
    subject: z.enum(SUBJECTS, {
      errorMap: () => ({ message: "Pick a subject." }),
    }),
    curriculum_id: z.string().uuid().optional().or(z.literal("")),
    custom_title: z.string().trim().max(120).optional(),
  })
  .refine((v) => Boolean(v.curriculum_id) || Boolean(v.custom_title), {
    message: "Choose from the catalog or type what you're using.",
    path: ["custom_title"],
  });

export const joinCoopSchema = z.object({
  join_code: z
    .string()
    .trim()
    .toUpperCase()
    .min(4, "Join codes are at least 4 characters.")
    .max(16),
});

export type FamilyInput = z.infer<typeof familySchema>;
export type StudentInput = z.infer<typeof studentSchema>;
export type BindingInput = z.infer<typeof bindingSchema>;

/** Shape returned by every onboarding server action, for useActionState. */
export interface ActionState {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

export const IDLE: ActionState = { ok: false };

export function toFieldErrors(err: z.ZodError): ActionState {
  return { ok: false, fieldErrors: err.flatten().fieldErrors as Record<string, string[]> };
}
