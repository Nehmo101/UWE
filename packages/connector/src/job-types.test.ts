import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  CONNECTOR_JOB_DESCRIPTORS,
  CONNECTOR_JOB_TYPES,
  capabilityForJobType,
  isConnectorJobType,
  laneForJobType,
} from "./job-types";
import { CONNECTOR_CAPABILITIES, CONNECTOR_CAPABILITY_LABELS } from "./capabilities";

const repoRoot = path.resolve(import.meta.dirname, "../../..");

function prismaEnumValues(schemaRelPath: string, enumName: string): string[] {
  const schema = readFileSync(path.join(repoRoot, schemaRelPath), "utf8");
  const match = new RegExp(`enum ${enumName} \\{([^}]*)\\}`).exec(schema);
  assert.ok(match, `${enumName} not found in ${schemaRelPath}`);
  return match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("//"));
}

describe("connector job catalogue", () => {
  it("describes every job type", () => {
    for (const type of CONNECTOR_JOB_TYPES) {
      const descriptor = CONNECTOR_JOB_DESCRIPTORS[type];
      assert.ok(descriptor, `missing descriptor for ${type}`);
      assert.ok(
        (CONNECTOR_CAPABILITIES as readonly string[]).includes(descriptor.capability),
        `${type} requires unknown capability ${descriptor.capability}`,
      );
    }
  });

  it("routes dictation to the GPU lane behind the stt_local capability", () => {
    assert.ok(isConnectorJobType("audio_transcribe"));
    assert.equal(laneForJobType("audio_transcribe"), "gpu");
    assert.equal(capabilityForJobType("audio_transcribe"), "stt_local");
    // A user waits on a transcript, so it outranks vision and image work.
    assert.ok(
      CONNECTOR_JOB_DESCRIPTORS.audio_transcribe.priority >
        CONNECTOR_JOB_DESCRIPTORS.vision_extract.priority,
    );
    assert.ok(
      CONNECTOR_JOB_DESCRIPTORS.audio_transcribe.priority <
        CONNECTOR_JOB_DESCRIPTORS.llm_generate.priority,
    );
  });

  it("labels every capability", () => {
    for (const capability of CONNECTOR_CAPABILITIES) {
      assert.ok(CONNECTOR_CAPABILITY_LABELS[capability], `missing label for ${capability}`);
    }
  });

  /**
   * The queue writes `ConnectorJob.type` straight into the Prisma enum. Without
   * this check a new job type only fails at runtime, on the first write.
   */
  it("stays in sync with the Prisma ConnectorJobType enum in both dialects", () => {
    for (const schema of [
      "packages/database/prisma/schema.prisma",
      "packages/database/prisma/schema.postgresql.prisma",
    ]) {
      const values = new Set(prismaEnumValues(schema, "ConnectorJobType"));
      for (const type of CONNECTOR_JOB_TYPES) {
        assert.ok(values.has(type), `${type} missing from ConnectorJobType in ${schema}`);
      }
      assert.equal(
        values.size,
        CONNECTOR_JOB_TYPES.length,
        `ConnectorJobType in ${schema} has values the code does not know`,
      );
    }
  });
});
