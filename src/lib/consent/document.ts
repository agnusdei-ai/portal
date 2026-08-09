import { createHash } from "node:crypto";

export type ConsentSection = { heading: string; body: string[] };

export type ConsentDocument = {
  version: string;
  lead: string;
  sections: ConsentSection[];
};

/**
 * Hash of the exact text rendered, so a retained hash cannot drift from what was
 * on screen. compliance/parental-consent.md §4 retains version and hash to
 * establish what a parent was actually shown.
 */
export function documentHash(doc: ConsentDocument): string {
  return createHash("sha256").update(JSON.stringify(doc)).digest("hex");
}
