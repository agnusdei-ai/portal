import type { ParticipantClass } from "@/lib/types";

/**
 * Mirror of `public.permitted_axes`, for giving a usable error before the
 * database gives an unusable one. The trigger in migration 0002 is the
 * enforcement; this is the courtesy.
 *
 * docs/portal.md §6a: the set is closed. There is no participant class for a
 * child, so there is no pair that could include one, which is what makes "no
 * adult-to-child interaction" a property of the schema rather than a promise in
 * a policy.
 */
export const PERMITTED_AXES: [ParticipantClass, ParticipantClass][] = [
  ["parent", "parent"],
  ["parent", "teacher"],
  ["teacher", "parent"],
  ["guide", "coop"],
  ["coop", "guide"],
];

export function axisPermitted(a: ParticipantClass, b: ParticipantClass): boolean {
  return PERMITTED_AXES.some(([x, y]) => x === a && y === b);
}

/** The classes that may reply to a listing posted in `posted_as`. */
export function repliersFor(posted_as: ParticipantClass): ParticipantClass[] {
  return PERMITTED_AXES.filter(([a]) => a === posted_as).map(([, b]) => b);
}

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

/**
 * Classes a listing category may be posted in. Keeps a co-op opening from being
 * posted by a household, which the axis table alone would permit.
 */
export const CATEGORY_CLASSES: Record<string, ParticipantClass[]> = {
  materials: ["parent"],
  coop_opening: ["coop"],
  class_offering: ["teacher", "coop"],
  announcement: ["parent", "coop"],
};
