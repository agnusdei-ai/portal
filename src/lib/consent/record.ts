import "server-only";

import { consentPool } from "@/lib/db";
import { NOTICE, NOTICE_SHA256 } from "@/lib/consent/notice";
import type { ConsentRecord } from "@/lib/types";

/**
 * Every write to the consent record. compliance/parental-consent.md §2 fixes the
 * order of the ceremony and §4 fixes what is retained, so both live here rather
 * than being reassembled at each call site.
 */

export async function ensureNoticeVersion(): Promise<void> {
  await consentPool().query(
    `insert into consent.notice_versions (version, sha256)
     values ($1, decode($2, 'hex'))
     on conflict (version) do nothing`,
    [NOTICE.version, NOTICE_SHA256],
  );
}

/**
 * §2 step 4: the notice is presented in full, and acknowledged, before consent
 * is sought. The record is opened here in state `notice_acknowledged`, which is
 * what establishes the ordering §4 requires evidence of.
 *
 * No account exists yet and none is created here. docs/portal.md §3 forbids any
 * family-keyed object before the transaction, and the account is exactly that.
 * This row is the consent evidence rather than a family record, so it may and
 * must precede the charge; `account_id` is filled in when consent is granted.
 */
export async function openRecord(args: {
  ownerUserId: string;
  childAccountName: string;
  acknowledgedAt: Date;
}): Promise<string> {
  await ensureNoticeVersion();

  const { rows } = await consentPool().query<{ id: string }>(
    `insert into consent.consent_records
       (owner_user_id, notice_version, notice_acknowledged_at, child_account_name, state)
     values ($1, $2, $3, $4, 'notice_acknowledged')
     returning id`,
    [args.ownerUserId, NOTICE.version, args.acknowledgedAt, args.childAccountName],
  );

  return rows[0].id;
}

/**
 * §2 step 5. Called only from the Stripe webhook, after the processor confirms a
 * genuine charge, because the cardholder's notification of that charge is what
 * supplies verification under §3.
 *
 * Idempotent on the processor reference: Stripe retries webhooks, and a second
 * delivery must not mint a second consent or a second seat.
 */
export async function grantConsent(args: {
  recordId: string;
  accountId: string;
  processorReference: string;
  completedAt: Date;
  seatId: string;
}): Promise<void> {
  await consentPool().query(
    `update consent.consent_records
        set state = 'granted',
            account_id = $2,
            processor_reference = $3,
            consent_completed_at = $4,
            seat_id = $5
      where id = $1
        and state = 'notice_acknowledged'`,
    [
      args.recordId,
      args.accountId,
      args.processorReference,
      args.completedAt,
      args.seatId,
    ],
  );
}

/**
 * §3: "A card issued to the child is not evidence of a parent." Where the
 * instrument is prepaid, the transaction does not establish what the method
 * relies upon, and the flow must fall back to another method rather than
 * accepting it. No seat is issued and the charge is refunded by the caller.
 */
export async function refuseConsent(args: {
  recordId: string;
  reason: string;
  processorReference: string | null;
}): Promise<void> {
  await consentPool().query(
    `update consent.consent_records
        set state = 'refused',
            method = 'fallback_pending',
            refusal_reason = $2,
            processor_reference = $3
      where id = $1`,
    [args.recordId, args.reason, args.processorReference],
  );
}

/**
 * The charge that evidenced this consent has been disputed or refunded, so the
 * consent is no longer evidenced. Recorded rather than deleted: the record is
 * what a fraud investigation and a card network both ask for.
 */
export async function markDisputed(recordId: string): Promise<void> {
  await consentPool().query(
    `update consent.consent_records set state = 'disputed' where id = $1`,
    [recordId],
  );
}

export async function getRecord(recordId: string): Promise<ConsentRecord | null> {
  const { rows } = await consentPool().query<ConsentRecord>(
    `select id, owner_user_id, account_id, notice_version,
            notice_acknowledged_at, consent_completed_at,
            processor_reference, child_account_name,
            method, state, refusal_reason, seat_id, created_at
       from consent.consent_records
      where id = $1`,
    [recordId],
  );
  return rows[0] ?? null;
}

/**
 * The names a parent may see for their own seats. This is the only path by which
 * a child account name leaves the consent schema, and it is keyed by account so
 * a caller must already have been authorised as that account's owner.
 */
export async function seatNamesForAccount(
  accountId: string,
): Promise<Map<string, string>> {
  const { rows } = await consentPool().query<{
    seat_id: string;
    child_account_name: string;
  }>(
    `select seat_id, child_account_name
       from consent.consent_records
      where account_id = $1 and state = 'granted' and seat_id is not null`,
    [accountId],
  );

  return new Map(rows.map((r) => [r.seat_id, r.child_account_name]));
}

export async function findByProcessorReference(
  reference: string,
): Promise<ConsentRecord | null> {
  const { rows } = await consentPool().query<ConsentRecord>(
    `select id, owner_user_id, account_id, notice_version,
            notice_acknowledged_at, consent_completed_at,
            processor_reference, child_account_name,
            method, state, refusal_reason, seat_id, created_at
       from consent.consent_records
      where processor_reference = $1`,
    [reference],
  );
  return rows[0] ?? null;
}
