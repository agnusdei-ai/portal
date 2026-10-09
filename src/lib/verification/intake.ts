import { z } from "zod";

import type { IdentityIntake } from "@/lib/verification/socure";

import { permittedDocuments } from "./states";

/**
 * The intake form's questions. The answers are transient PII: validated here,
 * relayed to Socure's evaluation API from the server, and written nowhere —
 * no table, no log (the spec's minimization promise, pinned by the log-
 * redaction test in tests/verification-socure.test.mjs).
 */
const baseSchema = z.object({
  residency: z.enum(["us", "international"], {
    errorMap: () => ({ message: "Choose where you live." }),
  }),
  firstName: z.string().trim().min(1, "Your first name is required.").max(80),
  middleName: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => (v ? v : undefined)),
  lastName: z.string().trim().min(1, "Your last name is required.").max(80),
  dob: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter your date of birth as YYYY-MM-DD."),
  email: z.string().trim().email("Enter your email address.").max(254),
  phone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => (v ? v : undefined)),
  line1: z
    .string()
    .trim()
    .min(1, "Your street address is required.")
    .max(120),
  line2: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v ? v : undefined)),
  city: z.string().trim().min(1, "Your city is required.").max(80),
  state: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v ? v : undefined)),
  postalCode: z
    .string()
    .trim()
    .max(16)
    .optional()
    .transform((v) => (v ? v : undefined)),
  country: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v ? v : undefined)),
});

/**
 * Residency shapes the address: a US resident gives a two-letter state and a
 * ZIP and verifies by license or passport; an international resident gives a
 * two-letter country, may have no postal code in the form the vendor expects,
 * and must verify by passport (spec art_ztdch8TP).
 */
export const intakeSchema = baseSchema.superRefine((value, ctx) => {
  if (value.residency === "us") {
    if (!/^[A-Za-z]{2}$/.test(value.state ?? "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter your two-letter state.",
        path: ["state"],
      });
    }
    if (!/^\d{5}$/.test(value.postalCode ?? "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter your five-digit ZIP code.",
        path: ["postalCode"],
      });
    }
    if (value.country && value.country !== "US") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A US resident's country is the United States.",
        path: ["country"],
      });
    }
  } else if (!/^[A-Za-z]{2}$/.test(value.country ?? "")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Enter your two-letter country code.",
      path: ["country"],
    });
  }
});

export type IntakeInput = z.infer<typeof intakeSchema>;

/** Resolves the country field and derives the permitted documents. */
export function toIdentityIntake(input: IntakeInput): IdentityIntake {
  return {
    residency: input.residency,
    firstName: input.firstName,
    middleName: input.middleName,
    lastName: input.lastName,
    dob: input.dob,
    email: input.email,
    phone: input.phone,
    address: {
      line1: input.line1,
      line2: input.line2,
      city: input.city,
      state: input.state,
      postalCode: input.postalCode,
      country: input.residency === "us" ? "US" : input.country!.toUpperCase(),
    },
    documentTypes: permittedDocuments(input.residency),
  };
}
