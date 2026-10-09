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

/**
 * Cryptocurrency dealing and off-platform payment steering.
 *
 * The operator's abuse brief is blunt about where a classified board for
 * homeschoolers gets hurt first: a "pay me in bitcoin" fraud arrives as a
 * listing or a reply, and the portal has no payment rails for it to hide
 * behind. These patterns sit in the same gate as the contact rules rather
 * than beside them — one refusal path, checked at submission.
 *
 * Tuning bar: the unit-test corpus in tests/abuse-heuristics.test.mjs. The
 * positives name the shapes and phrasings we refuse; the negatives are
 * ordinary curriculum language that must keep passing — a cryptozoology unit
 * study is not a cryptocurrency, and cryptography is not one either.
 */
const CRYPTO_SOLICITATION: { pattern: RegExp; label: string }[] = [
  {
    // Bech32 addresses (bitcoin bc1…, litecoin ltc1…).
    pattern: /\b(?:bc1|ltc1)[ac-hj-np-z02-9]{11,71}\b/i,
    label: "a cryptocurrency address",
  },
  {
    // Bitcoin legacy addresses (P2PKH "1…", P2SH "3…") in base58.
    pattern: /\b[13][1-9A-HJ-NP-Za-km-z]{25,39}\b/,
    label: "a cryptocurrency address",
  },
  {
    // Litecoin legacy addresses begin L (P2PKH) or M (P2SH).
    pattern: /\b[LM][1-9A-HJ-NP-Za-km-z]{26,35}\b/,
    label: "a cryptocurrency address",
  },
  {
    // EVM chains — ethereum and everything compatible with it.
    pattern: /0x[a-fA-F0-9]{40}\b/,
    label: "a cryptocurrency address",
  },
  {
    // A named coin within reach of a payment word: "usdt to my wallet".
    pattern: /\b(?:bitcoin|btc|ethereum|eth|litecoin|ltc|monero|xmr|usdt|usdc|dogecoin)\b[^.?!]{0,60}\b(?:pay|payment|wallet|address|escrow|donations?|invoices?|tips?|accepts?|accepting)\b/i,
    label: "a cryptocurrency payment arrangement",
  },
  {
    // The same, payment word first: "pay with bitcoin".
    pattern: /\b(?:pay|payment|accepts?|accepting)\b[^.?!]{0,60}\b(?:bitcoin|btc|ethereum|eth|litecoin|ltc|monero|xmr|usdt|usdc|dogecoin)\b/i,
    label: "a cryptocurrency payment arrangement",
  },
  {
    // "Crypto" alone with a payment word: "crypto wallet", "crypto payment".
    pattern: /\b(?:crypto|cryptocurrency)\b[^.?!]{0,60}\b(?:pay|payment|wallet|escrow)\b/i,
    label: "a cryptocurrency payment arrangement",
  },
  {
    // Wallet credentials — what a phishing reply is fishing for.
    pattern: /\b(?:wallet\s+address(?:es)?|wallet\s+seed|seed\s+phrase|seed\s+words|recovery\s+phrase)\b/i,
    label: "wallet credentials or a seed phrase",
  },
  {
    pattern: /\bkeystore\b/i,
    label: "wallet credentials or a seed phrase",
  },
  {
    // Payment apps outside the platform. Cash in hand at a handover is fine;
    // naming the app is how the steering starts.
    pattern: /\b(?:cash\s?app|cashapp|venmo|zelle|paypal(?:\.me)?)\b/i,
    label: "a payment app outside the platform",
  },
];

/**
 * Cryptocurrency or off-platform payment dealing in a listing or reply, as
 * the refusal message — or null when there is none. Exported so the exchange
 * actions can classify a refused submission for the abuse record without
 * re-deriving why it was refused.
 */
export function findCryptoSolicitation(text: string): string | null {
  for (const { pattern, label } of CRYPTO_SOLICITATION) {
    if (pattern.test(text)) {
      return `This looks like ${label}. The exchange carries no payment — cryptocurrency dealing and steering to payment apps outside the platform are not allowed here, and a listing or reply that does it is refused. If this is a mistake, rephrase it without the payment detail.`;
    }
  }
  return null;
}

export function findProhibitedContent(text: string): string | null {
  for (const { pattern, label } of CONTACT_PATTERNS) {
    if (pattern.test(text)) {
      return `This looks like it contains ${label}. Replies come through the exchange, so a listing never needs contact details, and publishing them would identify you to everyone reading.`;
    }
  }
  if (STREET_ADDRESS.test(text)) {
    return "This looks like it contains a street address. Listings carry a region only, and you arrange where to meet privately once someone replies.";
  }
  return findCryptoSolicitation(text);
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
    // Which capacity this is posted in. The database checks that the account
    // actually holds the class and, for teacher and guide, that a co-operative
    // vouches for them; this only catches a malformed submission early.
    posted_as: z.enum(["parent", "teacher", "guide", "coop"], {
      errorMap: () => ({ message: "Pick the capacity you are posting in." }),
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
