import { createHmac, timingSafeEqual } from "node:crypto";

import type {
  VerificationDocumentType,
  VerificationState,
} from "@/lib/types";

import { isSocureDecision, mapSocureDecision } from "./states";
import type { SocureDecision } from "./states";

/**
 * Webhook mechanics for the Socure evaluation-completion event, split from
 * the route so they are testable on fixtures. No part of this module logs
 * payload content — the event body can carry identity attributes (a name, a
 * document number, an address) even though the portal never persists them.
 */

/** Freshness window for the timestamped signature; replays outside it fail. */
const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

/**
 * Verifies the timestamped HMAC signature header
 * (`t=<unix-seconds>, v1=<hex digest>` over `<t>.<raw body>`, HMAC-SHA256 with
 * the tenant's webhook verification secret). The tenant's webhook security
 * configuration governs the exact scheme; it lives in env, never in code.
 */
export function verifyWebhookSignature(options: {
  secret: string;
  header: string | null;
  rawBody: string;
  nowSeconds?: number;
}): boolean {
  const { secret, header, rawBody, nowSeconds } = options;
  if (!secret || !header) return false;

  const parts = Object.fromEntries(
    header.split(",").map((pair) => pair.trim().split("=")),
  );
  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) return false;

  const age = (nowSeconds ?? Math.floor(Date.now() / 1000)) - Number(timestamp);
  if (!Number.isFinite(age) || Math.abs(age) > TIMESTAMP_TOLERANCE_SECONDS) {
    return false;
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface WebhookEvent {
  vendorEvaluationId: string;
  docvReferenceId: string | null;
  documentType: VerificationDocumentType | null;
  outcome: SocureDecision | null;
  reasonCodes: string[];
}

type UnknownRecord = Record<string, unknown>;

const isRecord = (v: unknown): v is UnknownRecord =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];

/**
 * Normalizes the two event surfaces the portal enables — the ID+ evaluation
 * and the DocV capture result — onto one webhook event. Vendor shapes vary by
 * product surface; unknown events parse to null and are acknowledged without
 * a write.
 */
export function parseWebhookEvent(payload: unknown): WebhookEvent | null {
  if (!isRecord(payload)) return null;
  const data = isRecord(payload.data)
    ? payload.data
    : isRecord(payload.body)
      ? payload.body
      : null;
  if (!data) return null;

  const reference =
    pickString(data, [
      "referenceId",
      "vendorEvaluationId",
      "evaluationId",
      "transactionId",
    ]) ?? null;
  if (!reference) return null;

  const outcome = pickString(data, ["outcome", "decision", "result"]);
  const documentType = pickString(data, ["documentType", "idType", "document_type"]);
  const reasonCodes = strings(data.reasonCodes ?? data.reason_codes ?? data.reasons);

  return {
    vendorEvaluationId: reference,
    docvReferenceId:
      pickString(data, [
        "docvTransactionId",
        "docvReferenceId",
        "selfieTransactionId",
      ]) ?? null,
    documentType:
      documentType === "passport"
        ? "passport"
        : documentType === "drivers_license"
          ? "drivers_license"
          : null,
    outcome: isSocureDecision(outcome) ? outcome : null,
    reasonCodes,
  };

  function pickString(record: UnknownRecord, keys: string[]): string | undefined {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "string" && value.length > 0) return value;
    }
    return undefined;
  }
}

export interface WebhookWrite {
  state: VerificationState;
  documentType: VerificationDocumentType | null;
  docvReferenceId: string | null;
  verifiedAt: Date | null;
  reasonCodes: string[];
}

/** Builds the write for the event, or null when nothing should change. */
export function buildWrite(event: WebhookEvent): WebhookWrite | null {
  if (!event.outcome) return null;
  const state = mapSocureDecision(event.outcome);
  return {
    state,
    documentType: event.documentType,
    docvReferenceId: event.docvReferenceId,
    verifiedAt: state === "verified" ? new Date() : null,
    reasonCodes: event.reasonCodes,
  };
}

export interface AttestationUpdate {
  /** The column patch; absent keys leave the stored value untouched. */
  patch: {
    state: VerificationState;
    document_type?: VerificationDocumentType;
    docv_reference_id?: string;
    verified_at?: string;
    reason_codes: string[];
  };
  /** States the update may move — redelivered events on terminal states are no-ops. */
  guardStates: VerificationState[];
}

/**
 * Shapes the PostgREST update for a webhook write. Only in-flight states are
 * updatable, so a redelivered event for an evaluation that already reached
 * `verified` or `declined` touches nothing and `verified_at` records the
 * first completion. Null document fields are omitted, never clobbered.
 */
export function buildUpdate(write: WebhookWrite): AttestationUpdate {
  const patch: AttestationUpdate["patch"] = {
    state: write.state,
    reason_codes: write.reasonCodes,
  };
  if (write.documentType) patch.document_type = write.documentType;
  if (write.docvReferenceId) patch.docv_reference_id = write.docvReferenceId;
  if (write.verifiedAt) patch.verified_at = write.verifiedAt.toISOString();

  return {
    patch,
    guardStates: ["pending", "retry_required", "manual_review"],
  };
}
