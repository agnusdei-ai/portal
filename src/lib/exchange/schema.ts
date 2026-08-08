import { z } from "zod";

import type { ListingCategory } from "@/lib/types";

export const CATEGORIES: { value: ListingCategory; label: string; blurb: string }[] = [
  {
    value: "materials",
    label: "Materials",
    blurb: "Books, kits, microscopes, manipulatives. Offered, sought or traded.",
  },
  {
    value: "coop_opening",
    label: "Co-op opening",
    blurb: "A co-operative with room for more families.",
  },
  {
    value: "class_offering",
    label: "Class",
    blurb: "A class run by an identified organisation.",
  },
  {
    value: "announcement",
    label: "Announcement",
    blurb: "Park days, fairs, curriculum sales.",
  },
];

/**
 * Contact details in listing text.
 *
 * docs/portal.md §7 prohibits free-text contact details of any kind, because
 * they defeat the reply relay, and the relay is the mechanism that keeps a
 * poster non-enumerable. A listing carrying an email address has published its
 * author, whatever the rest of the rules say.
 *
 * These patterns catch the ordinary cases rather than a determined evader. They
 * are a guard rail, not a boundary: the boundary is that the relay is the only
 * reply path the product offers.
 */
const CONTACT_PATTERNS: { pattern: RegExp; label: string }[] = [
  {
    pattern: /[\w.+-]+@[\w-]+\.[\w.-]+/,
    label: "an email address",
  },
  {
    // A North American number in the formats people actually type. Deliberately
    // shaped rather than "ten digits somewhere", which flags a listing quoting a
    // price, an edition and a year in the same sentence.
    pattern: /(?:\+?\d[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}/,
    label: "a telephone number",
  },
  {
    pattern: /\b(?:t\.me|wa\.me|signal\.me|facebook\.com|instagram\.com|discord\.gg)\S*/i,
    label: "a messaging or social link",
  },
  {
    pattern: /\b(?:text|call|email|dm|whatsapp)\s+me\b/i,
    label: "an invitation to make contact off-platform",
  },
];

/**
 * A street address. docs/portal.md §7: geography is coarse, and the meeting
 * place for an exchange is negotiated over the relay and never published.
 */
const STREET_ADDRESS =
  /\b\d{1,6}\s+[A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*)*\s+(?:st(?:reet)?|ave(?:nue)?|rd|road|dr(?:ive)?|ln|lane|blvd|boulevard|ct|court|way|pl(?:ace)?)\b/i;

export function findProhibitedContent(text: string): string | null {
  for (const { pattern, label } of CONTACT_PATTERNS) {
    if (pattern.test(text)) {
      return `This looks like it contains ${label}. Replies come through the exchange, so a listing never needs contact details, and publishing them would identify you to everyone reading.`;
    }
  }
  if (STREET_ADDRESS.test(text)) {
    return "This looks like it contains a street address. Listings carry a region only, and you arrange where to meet privately once someone replies.";
  }
  return null;
}

const noProhibited = (field: string) =>
  z.string().superRefine((value, ctx) => {
    const problem = findProhibitedContent(value);
    if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem, path: [field] });
  });

export const listingSchema = z
  .object({
    category: z.enum(["materials", "coop_opening", "class_offering", "announcement"], {
      errorMap: () => ({ message: "Pick a category." }),
    }),
    title: z.string().trim().min(3, "Give it a title.").max(120),
    body: z.string().trim().min(10, "Say a little more.").max(4000),
    state_code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, "Use a two-letter state code."),
    region: z
      .string()
      .trim()
      .min(2, "A metropolitan area or county, not an address.")
      .max(80),
    // The rules a regular expression cannot check. docs/portal.md §7 prohibits
    // naming a child or publishing a roster, and neither is detectable, so the
    // poster is asked to attest rather than being silently trusted.
    attested: z.literal("on", {
      errorMap: () => ({
        message: "Please confirm before posting.",
      }),
    }),
  })
  .superRefine((value, ctx) => {
    for (const field of ["title", "body"] as const) {
      const problem = findProhibitedContent(value[field]);
      if (problem) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem, path: [field] });
      }
    }
  });

export const replySchema = z.object({
  listing_id: z.string().uuid(),
  body: noProhibited("body")
    .pipe(z.string().trim().min(1, "Write something.").max(2000)),
});

export interface ExchangeActionState {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

export const EXCHANGE_IDLE: ExchangeActionState = { ok: false };
