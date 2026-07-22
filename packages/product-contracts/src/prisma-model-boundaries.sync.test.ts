import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { PRISMA_MODEL_BOUNDARIES } from "./prisma-model-boundaries";

/**
 * The mapping is authoritative only if it stays in lock-step with the Prisma
 * schema. This reads the schema text (no DB/prisma client needed) and asserts
 * the model set matches exactly — so adding or removing a Prisma model fails CI
 * until PRISMA_MODEL_BOUNDARIES is updated (O02 §10 "Mapping-Drift").
 */
const SCHEMA_PATH = fileURLToPath(
  new URL("../../database/prisma/schema.prisma", import.meta.url),
);

function schemaModelNames(): string[] {
  const text = readFileSync(SCHEMA_PATH, "utf8");
  const names: string[] = [];
  for (const line of text.split("\n")) {
    const match = /^model\s+([A-Za-z0-9_]+)\s*\{/.exec(line.trim());
    if (match) names.push(match[1]);
  }
  return names;
}

describe("prisma model boundaries stay in sync with schema.prisma", () => {
  const schema = new Set(schemaModelNames());
  const mapping = new Set(Object.keys(PRISMA_MODEL_BOUNDARIES));

  it("covers exactly the models declared in the schema", () => {
    const missingFromMapping = [...schema].filter((m) => !mapping.has(m)).sort();
    const staleInMapping = [...mapping].filter((m) => !schema.has(m)).sort();
    assert.deepEqual(
      { missingFromMapping, staleInMapping },
      { missingFromMapping: [], staleInMapping: [] },
      "PRISMA_MODEL_BOUNDARIES must match schema.prisma exactly — update the mapping when models change.",
    );
  });

  it("has the same model count as the schema", () => {
    assert.equal(mapping.size, schema.size);
    assert.ok(schema.size > 0, "schema model extraction should not be empty");
  });
});
