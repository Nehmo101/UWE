import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  JOB_ENVELOPE_SCHEMA_VERSION,
  assertNoBrainLeak,
  isEnvelopeCloudRoutable,
  validateJobEnvelope,
  type JobEnvelope,
} from "./job-envelope";

function makeEnvelope(overrides: Partial<JobEnvelope> = {}): JobEnvelope {
  return {
    schemaVersion: JOB_ENVELOPE_SCHEMA_VERSION,
    audience: "brain",
    dataDomain: "personal_brain",
    privacyClass: "owner_private_local",
    payloadHandle: "handle-123",
    ...overrides,
  };
}

describe("job envelope validation", () => {
  it("accepts a well-formed envelope whose audience may touch the domain", () => {
    const result = validateJobEnvelope({
      audience: "studio",
      dataDomain: "dnd_world",
      privacyClass: "dm_only",
      payloadHandle: "abc",
    });
    assert.ok(result.ok);
    assert.equal(result.envelope.schemaVersion, JOB_ENVELOPE_SCHEMA_VERSION);
  });

  it("rejects invalid tags and empty handles (deny-by-default)", () => {
    assert.equal(validateJobEnvelope({ audience: "owner", dataDomain: "dnd_world", privacyClass: "dm_only", payloadHandle: "x" }).ok, false);
    assert.equal(validateJobEnvelope({ audience: "studio", dataDomain: "nope", privacyClass: "dm_only", payloadHandle: "x" }).ok, false);
    assert.equal(validateJobEnvelope({ audience: "studio", dataDomain: "dnd_world", privacyClass: "secret", payloadHandle: "x" }).ok, false);
    assert.equal(validateJobEnvelope({ audience: "studio", dataDomain: "dnd_world", privacyClass: "dm_only", payloadHandle: "  " }).ok, false);
  });

  it("rejects an audience that may not touch the declared domain", () => {
    // Portal has no access to personal_brain — must be refused.
    const result = validateJobEnvelope({
      audience: "portal",
      dataDomain: "personal_brain",
      privacyClass: "owner_private_local",
      payloadHandle: "x",
    });
    assert.equal(result.ok, false);
  });

  it("rejects an unsupported schema version", () => {
    const result = validateJobEnvelope({
      audience: "studio",
      dataDomain: "dnd_world",
      privacyClass: "dm_only",
      payloadHandle: "x",
      schemaVersion: 999,
    });
    assert.equal(result.ok, false);
  });
});

describe("job envelope cloud/brain-leak guards", () => {
  it("never marks owner-private brain work as cloud-routable", () => {
    assert.equal(isEnvelopeCloudRoutable(makeEnvelope({ dataDomain: "personal_brain" })), false);
    assert.equal(isEnvelopeCloudRoutable(makeEnvelope({ dataDomain: "admin_life" })), false);
    assert.equal(
      isEnvelopeCloudRoutable(makeEnvelope({ audience: "studio", dataDomain: "dnd_world", privacyClass: "dm_only" })),
      true,
    );
  });

  it("blocks dispatching brain-only work to a non-brain audience", () => {
    const brainJob = makeEnvelope();
    assert.throws(() => assertNoBrainLeak(brainJob, "studio"));
    assert.throws(() => assertNoBrainLeak(brainJob, "portal"));
    assert.throws(() => assertNoBrainLeak(brainJob, "platform"));
    assert.doesNotThrow(() => assertNoBrainLeak(brainJob, "brain"));
  });
});
