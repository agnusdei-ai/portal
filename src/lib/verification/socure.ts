import type { VerificationDocumentType } from "@/lib/types";

import { isSocureDecision, provisionalState } from "./states";
import type { SocureDecision } from "./states";

/**
 * The identity fields the evaluation needs. They exist in memory for the length
 * of one server call and are written nowhere — not the database, not a log.
 * The spec's minimization promise: intake PII transits the portal to Socure,
 * it does not reside. Nothing in this module calls a logger.
 */
export interface IdentityIntake {
  residency: "us" | "international";
  firstName: string;
  middleName?: string;
  lastName: string;
  /** ISO date, YYYY-MM-DD. */
  dob: string;
  email: string;
  phone?: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postalCode?: string;
    country: string;
  };
  /** Derived from residency by the intake form; the vendor request carries it. */
  documentTypes: VerificationDocumentType[];
}

export interface SocureConfig {
  baseUrl: string;
  apiKey: string;
}

/**
 * What the ID+ evaluation returns, normalized. The wire contract (field names,
 * the request path) is the fixture contract the sandbox is confirmed against
 * during tenant onboarding — the spec's "sandbox reality check". Drift fails
 * loudly here rather than silently downstream.
 */
export interface EvaluationStart {
  vendorEvaluationId: string;
  /** Already provisional-mapped: accept is only ever "pending" here. */
  state: import("@/lib/types").VerificationState;
  reasonCodes: string[];
  /** Short-lived token for the DocV Web SDK handoff; present while capture can proceed. */
  docvTransactionToken: string | null;
}

/** Raised for vendor unreachability, non-2xx responses, and contract drift. */
export class SocureError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "SocureError";
  }
}

/** Sandbox by default; the operator's tenant base URL replaces it at rollout. */
const DEFAULT_BASE_URL = "https://riskos.sandbox.socure.com";

/**
 * The evaluation request path, per the DevHub ID+ evaluation guide. Confirmed
 * against the tenant at onboarding; a version change is a one-line edit here.
 */
const EVALUATION_PATH = "/api/v2.2/eval";

export function configFromEnv(): SocureConfig {
  const apiKey = process.env.SOCURE_API_KEY;
  if (!apiKey) {
    throw new SocureError("SOCURE_API_KEY is not set; identity evaluation cannot run.");
  }
  return { baseUrl: process.env.SOCURE_BASE_URL || DEFAULT_BASE_URL, apiKey };
}

/** The wire body. PII appears here exactly once — on its way out. */
function evaluationRequest(intake: IdentityIntake): Record<string, unknown> {
  return {
    firstName: intake.firstName,
    middleName: intake.middleName,
    lastName: intake.lastName,
    dob: intake.dob,
    email: intake.email,
    phone: intake.phone,
    address: {
      line1: intake.address.line1,
      line2: intake.address.line2,
      city: intake.address.city,
      state: intake.address.state,
      postalCode: intake.address.postalCode,
      country: intake.address.country,
    },
    documentTypes: intake.documentTypes,
  };
}

function parseEvaluationStart(body: unknown): EvaluationStart {
  if (typeof body !== "object" || body === null) {
    throw new SocureError("The identity vendor's response was not an object.");
  }
  const raw = body as Record<string, unknown>;

  const vendorEvaluationId = raw.requestId;
  if (typeof vendorEvaluationId !== "string" || !vendorEvaluationId) {
    throw new SocureError("The identity vendor's response carried no evaluation reference.");
  }
  if (!isSocureDecision(raw.decision)) {
    throw new SocureError(
      "The identity vendor's decision is outside the fixture contract.",
    );
  }

  const reasonCodes = Array.isArray(raw.reasonCodes)
    ? raw.reasonCodes.filter((c): c is string => typeof c === "string")
    : [];

  const docv = raw.docv as Record<string, unknown> | undefined | null;
  const docvTransactionToken =
    docv && typeof docv === "object" && typeof docv.transactionToken === "string"
      ? docv.transactionToken
      : null;

  return {
    vendorEvaluationId,
    state: provisionalState(raw.decision),
    reasonCodes,
    docvTransactionToken,
  };
}

export interface StartEvaluationDeps {
  config?: SocureConfig;
  fetch?: typeof fetch;
}

/**
 * POSTs the intake to Socure ID+ and normalizes the outcome. Dependency-
 * injected so tests drive it with fixture responses; the action calls it bare.
 *
 * The request body is never logged and the intake is never persisted — if this
 * module ever grows a console call, tests/verification-socure.test.mjs fails.
 */
export async function startEvaluation(
  intake: IdentityIntake,
  deps: StartEvaluationDeps = {},
): Promise<EvaluationStart> {
  const config = deps.config ?? configFromEnv();
  const doFetch = deps.fetch ?? fetch;

  let response: Response;
  try {
    response = await doFetch(`${config.baseUrl}${EVALUATION_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(evaluationRequest(intake)),
      // A hung vendor call must not hold the action open indefinitely.
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    if (err instanceof SocureError) throw err;
    throw new SocureError("The identity vendor could not be reached.", { cause: err });
  }

  if (!response.ok) {
    throw new SocureError(`The identity vendor returned ${response.status}.`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (err) {
    throw new SocureError("The identity vendor's response was not JSON.", { cause: err });
  }

  return parseEvaluationStart(body);
}

export type { SocureDecision };
