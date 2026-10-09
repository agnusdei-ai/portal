import type { ParticipantClass } from "@/lib/types";

/**
 * Vetted tutor discovery (spec art_ztdch8TP, tutor persona row: the agent
 * interface returns trust and discovery data, never identity PII).
 *
 * The inputs are exactly the rows the caller's own RLS session can already
 * read — active vouches, listed co-ops, the closed axis table — and the output
 * is an allowlisted shape over them. Nothing here scores, profiles, or
 * contacts: docs/portal.md §6a makes the co-operative vouch the only
 * reachability a teacher or guide has, and this module adds none of its own.
 * Per-tutor Socure attestation state is absent because RLS confines
 * attestations to their own account (0003) and the agent API creates no new
 * read surface — the vouch is the platform's published trust fact.
 */

export type VouchRow = {
  account_id: string;
  class: ParticipantClass;
  vouched_at: string;
  coop_listing_id: string;
};

export type CoopRow = {
  id: string;
  slug: string;
  name: string;
  state_code: string | null;
  region: string | null;
};

export type AxisRow = { a: ParticipantClass; b: ParticipantClass };

export type DiscoveryInput = {
  /** The calling principal, so an account cannot discover itself. */
  callerAccountId: string;
  /** The caller's own classes, read through their own RLS session. */
  callerClasses: ParticipantClass[];
  /** Active vouches — the "vouches are public" policy already excludes revoked rows. */
  vouches: VouchRow[];
  /** Listed co-operatives — the "listed co-ops are public" policy. */
  coops: CoopRow[];
  /** The closed axis table, read as data (docs/portal.md §6). */
  axes: AxisRow[];
};

export type TutorVouch = {
  class: ParticipantClass;
  vouched_at: string;
  coop: CoopRow;
};

export type TutorHit = {
  account_id: string;
  /** Every class the account holds an active vouch for. */
  classes: ParticipantClass[];
  vouches: TutorVouch[];
  /** The permitted-axis rows connecting one of the caller's classes to one of this account's. */
  axes: AxisRow[];
};

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 100;

/** A value outside 1..MAX_LIMIT is refused by the route, not clamped. */
export function parseLimit(raw: string | null): number | "invalid-limit" {
  if (raw === null || raw === "") return DEFAULT_LIMIT;
  if (!/^\d+$/.test(raw)) return "invalid-limit";
  const value = Number(raw);
  if (value < 1 || value > MAX_LIMIT) return "invalid-limit";
  return value;
}

export function discoverTutors(input: DiscoveryInput, limit: number = DEFAULT_LIMIT): TutorHit[] {
  const coopById = new Map(input.coops.map((coop) => [coop.id, coop]));

  const vouchesByAccount = new Map<string, TutorVouch[]>();
  for (const row of input.vouches) {
    // A vouch behind a co-op the caller cannot see is not a fact this API
    // asserts — it stays invisible, exactly as on the public board.
    const coop = coopById.get(row.coop_listing_id);
    if (!coop || row.account_id === input.callerAccountId) continue;
    const entries = vouchesByAccount.get(row.account_id) ?? [];
    entries.push({ class: row.class, vouched_at: row.vouched_at, coop });
    vouchesByAccount.set(row.account_id, entries);
  }

  const hits: TutorHit[] = [];
  for (const [accountId, entries] of vouchesByAccount) {
    const classes = [...new Set(entries.map((entry) => entry.class))];

    // permitted_axes holds every pair in both orders, "so a lookup never has
    // to normalise the pair" (0002_participants.sql) — one direction suffices.
    // This filter is the "where the communication axes permit" rule: trust
    // data about an account reaches only a principal who could already
    // communicate with its class.
    const permitted = input.axes.filter(
      (axis) => input.callerClasses.includes(axis.a) && classes.includes(axis.b),
    );
    if (permitted.length === 0) continue;

    entries.sort((x, y) => (x.vouched_at < y.vouched_at ? 1 : x.vouched_at > y.vouched_at ? -1 : 0));
    hits.push({
      account_id: accountId,
      classes,
      vouches: entries,
      axes: permitted.map((axis) => ({ a: axis.a, b: axis.b })),
    });
  }

  // Newest vouch first — recency is the one honest order trust data has —
  // then account id, so the same query returns the same page twice.
  return hits
    .sort((x, y) => {
      const newestX = x.vouches[0]?.vouched_at ?? "";
      const newestY = y.vouches[0]?.vouched_at ?? "";
      if (newestX !== newestY) return newestX < newestY ? 1 : -1;
      return x.account_id < y.account_id ? -1 : x.account_id > y.account_id ? 1 : 0;
    })
    .slice(0, limit);
}
