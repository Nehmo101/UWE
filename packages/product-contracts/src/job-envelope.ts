// Product-tagged job envelope. Jobs cross product boundaries as an opaque handle
// plus explicit product tags — never as untyped cross-product JSON that could
// smuggle owner-private content into a portal/studio/cloud runner (O02 §9, L-3).
import {
  isAppAudience,
  isBrainOnlyDataDomain,
  isDataDomain,
  isPrivacyClass,
  type AppAudience,
  type DataDomain,
  type PrivacyClass,
} from "./domain-boundaries";
import { getDomainAccess } from "./domain-access";

export const JOB_ENVELOPE_SCHEMA_VERSION = 1 as const;

export interface JobEnvelope {
  readonly schemaVersion: typeof JOB_ENVELOPE_SCHEMA_VERSION;
  /** Product that owns/enqueued the job. */
  readonly audience: AppAudience;
  /** Product data domain the job operates on. */
  readonly dataDomain: DataDomain;
  /** Sensitivity of that data. */
  readonly privacyClass: PrivacyClass;
  /** Opaque reference to the payload — never the fachliche content itself. */
  readonly payloadHandle: string;
}

export interface JobEnvelopeInput {
  audience: unknown;
  dataDomain: unknown;
  privacyClass: unknown;
  payloadHandle: unknown;
  schemaVersion?: unknown;
}

export type JobEnvelopeValidation =
  | { readonly ok: true; readonly envelope: JobEnvelope }
  | { readonly ok: false; readonly error: string };

/** Deny-by-default validation of an untrusted envelope input. */
export function validateJobEnvelope(input: JobEnvelopeInput): JobEnvelopeValidation {
  if (!isAppAudience(input.audience)) {
    return { ok: false, error: "invalid audience" };
  }
  if (!isDataDomain(input.dataDomain)) {
    return { ok: false, error: "invalid dataDomain" };
  }
  if (!isPrivacyClass(input.privacyClass)) {
    return { ok: false, error: "invalid privacyClass" };
  }
  if (typeof input.payloadHandle !== "string" || !input.payloadHandle.trim()) {
    return { ok: false, error: "payloadHandle must be a non-empty string" };
  }
  if (input.schemaVersion !== undefined && input.schemaVersion !== JOB_ENVELOPE_SCHEMA_VERSION) {
    return { ok: false, error: "unsupported schemaVersion" };
  }
  // The declared audience must actually be permitted to touch the declared domain.
  if (getDomainAccess(input.audience, input.dataDomain) === "none") {
    return {
      ok: false,
      error: `audience "${input.audience}" may not touch domain "${input.dataDomain}"`,
    };
  }
  return {
    ok: true,
    envelope: {
      schemaVersion: JOB_ENVELOPE_SCHEMA_VERSION,
      audience: input.audience,
      dataDomain: input.dataDomain,
      privacyClass: input.privacyClass,
      payloadHandle: input.payloadHandle,
    },
  };
}

/** Owner-private brain data (personal_brain/admin_life, owner_private_local) is
 *  never cloud-routable — a local failure waits or errors, it never falls back. */
export function isEnvelopeCloudRoutable(envelope: JobEnvelope): boolean {
  if (isBrainOnlyDataDomain(envelope.dataDomain)) {
    return false;
  }
  if (envelope.privacyClass === "owner_private_local") {
    return false;
  }
  return true;
}

/** Throws if a brain-only job is being dispatched to a non-brain audience. */
export function assertNoBrainLeak(envelope: JobEnvelope, targetAudience: AppAudience): void {
  const brainOnly =
    isBrainOnlyDataDomain(envelope.dataDomain) || envelope.privacyClass === "owner_private_local";
  if (targetAudience !== "brain" && brainOnly) {
    throw new Error(
      `Brain-only job (domain "${envelope.dataDomain}") cannot be dispatched to audience "${targetAudience}".`,
    );
  }
}
