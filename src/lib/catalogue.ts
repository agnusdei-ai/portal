/**
 * Public-zone vocabulary. docs/portal.md §9: the catalogue is populated from
 * published sources and never from what families are observed to use, which
 * would be the §5 join aggregated and laundered back into the public zone.
 */
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

export type Subject = (typeof SUBJECTS)[number];
