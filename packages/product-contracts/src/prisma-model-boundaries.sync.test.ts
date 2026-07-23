import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { PRISMA_MODEL_BOUNDARIES } from "./prisma-model-boundaries";

/**
 * The mapping is authoritative only if it stays in lock-step with the Prisma
 * schemas. Since the Zwei-Client split the models live in two files —
 * schema.prisma (uwe.db) and brain/schema.prisma (uwe-brain.db) — so this
 * reads both schema texts (no DB/prisma client needed) and asserts the union
 * matches exactly, and that each model's declared targetDatabase matches the
 * schema file that actually declares it — so adding, removing, or moving a
 * Prisma model fails CI until PRISMA_MODEL_BOUNDARIES is updated
 * (O02 §10 "Mapping-Drift").
 */
const MAIN_SCHEMA_PATH = fileURLToPath(
  new URL("../../database/prisma/schema.prisma", import.meta.url),
);
const BRAIN_SCHEMA_PATH = fileURLToPath(
  new URL("../../database/prisma/brain/schema.prisma", import.meta.url),
);

function schemaModelNames(path: string): string[] {
  const text = readFileSync(path, "utf8");
  const names: string[] = [];
  for (const line of text.split("\n")) {
    const match = /^model\s+([A-Za-z0-9_]+)\s*\{/.exec(line.trim());
    if (match) names.push(match[1]);
  }
  return names;
}

describe("prisma model boundaries stay in sync with the prisma schemas", () => {
  const mainSchema = new Set(schemaModelNames(MAIN_SCHEMA_PATH));
  const brainSchema = new Set(schemaModelNames(BRAIN_SCHEMA_PATH));
  const schema = new Set([...mainSchema, ...brainSchema]);
  const mapping = new Set(Object.keys(PRISMA_MODEL_BOUNDARIES));

  it("covers exactly the models declared across both schemas", () => {
    const missingFromMapping = [...schema].filter((m) => !mapping.has(m)).sort();
    const staleInMapping = [...mapping].filter((m) => !schema.has(m)).sort();
    assert.deepEqual(
      { missingFromMapping, staleInMapping },
      { missingFromMapping: [], staleInMapping: [] },
      "PRISMA_MODEL_BOUNDARIES must match schema.prisma + brain/schema.prisma exactly — update the mapping when models change.",
    );
  });

  it("has the same model count as both schemas combined", () => {
    assert.equal(mapping.size, schema.size);
    assert.ok(mainSchema.size > 0, "main schema model extraction should not be empty");
    assert.ok(brainSchema.size > 0, "brain schema model extraction should not be empty");
    const declaredInBoth = [...mainSchema].filter((m) => brainSchema.has(m));
    assert.deepEqual(declaredInBoth, [], "a model must live in exactly one schema");
  });

  it("declares targetDatabase matching the schema file that holds the model", () => {
    const mismatches: string[] = [];
    for (const [name, boundaryEntry] of Object.entries(PRISMA_MODEL_BOUNDARIES)) {
      const expected = brainSchema.has(name) ? "uwe-brain.db" : "uwe.db";
      if (boundaryEntry.targetDatabase !== expected) {
        mismatches.push(`${name}: mapping=${boundaryEntry.targetDatabase} schema=${expected}`);
      }
    }
    assert.deepEqual(mismatches, []);
  });
});
