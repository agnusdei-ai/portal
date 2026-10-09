/**
 * Whether a stored acceptance satisfies the waiver as currently published
 * (spec art_ztdch8TP, "Governing text").
 *
 * The version bump is the re-acceptance mechanism, so an acceptance is judged
 * by the version and hash of what was shown when it was made: a row accepted
 * under an older version is not an acceptance of the new one. It is asked
 * again — once, at the next participation — and the acceptance under the
 * current version ends the loop, because the check is a comparison, not a
 * countdown.
 *
 * Import-free on purpose, like the other decision modules: the tests execute
 * this function directly.
 */

export type AcceptedWaiver = {
  version: string | null;
  withdrawn_at: string | null;
} | null;

export function waiverIsCurrent(row: AcceptedWaiver, currentVersion: string): boolean {
  return row !== null && row.withdrawn_at === null && row.version === currentVersion;
}
