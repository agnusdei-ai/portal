import type { ParticipantClass } from "@/lib/types";

/**
 * Display copy and the category-to-capacity map the posting form needs.
 *
 * The permitted axes themselves are not mirrored here. They live in
 * `public.permitted_axes` and are enforced by triggers in migration 0002; a copy
 * in TypeScript would be a second source of truth kept honest by a drift test.
 */
export const CLASS_COPY: Record<ParticipantClass, { label: string; blurb: string }> = {
  parent: {
    label: "As a household",
    blurb: "Materials, information and anything else households trade directly.",
  },
  teacher: {
    label: "As an educator",
    blurb: "Instruction offered to families. Needs a co-operative to vouch for you.",
  },
  guide: {
    label: "As a guide",
    blurb: "Leading classes. Needs a co-operative to vouch for you.",
  },
  coop: {
    label: "As a co-operative",
    blurb: "Posting for a co-operative you direct.",
  },
};

/** Which capacities may post in each category. */
export const CATEGORY_CLASSES: Record<string, ParticipantClass[]> = {
  materials: ["parent"],
  coop_opening: ["coop"],
  class_offering: ["teacher", "coop"],
  announcement: ["parent", "coop"],
};
