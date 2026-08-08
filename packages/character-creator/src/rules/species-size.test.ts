import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { findLineage, findSpecies } from "../content";
import { resolveSpeciesSize } from "./derive";

describe("resolveSpeciesSize", () => {
  it("goblin lineage overrides goblinkin parent size to small", () => {
    const species = findSpecies("goblinkin");
    const goblin = findLineage("goblinkin", "goblin");
    assert.ok(species);
    assert.ok(goblin);
    assert.equal(goblin.size, "small");
    assert.equal(resolveSpeciesSize(species, goblin), "small");
  });

  it("hobgoblin and bugbear keep goblinkin medium default", () => {
    const species = findSpecies("goblinkin");
    assert.ok(species);
    for (const key of ["hobgoblin", "bugbear"] as const) {
      const lineage = findLineage("goblinkin", key);
      assert.ok(lineage);
      assert.equal(lineage.size, undefined);
      assert.equal(resolveSpeciesSize(species, lineage), "medium");
    }
  });

  it("draft sizeKey wins over lineage and parent default", () => {
    const species = findSpecies("mensch");
    assert.ok(species);
    assert.equal(resolveSpeciesSize(species, null, "small"), "small");
    assert.equal(resolveSpeciesSize(species, null, "medium"), "medium");
  });

  it("sizeKey is ignored when not in species sizeChoice", () => {
    const species = findSpecies("zwerg");
    assert.ok(species);
    assert.equal(species.sizeChoice, undefined);
    assert.equal(resolveSpeciesSize(species, null, "small"), "medium");
  });

  it("lineage size applies when sizeKey is null", () => {
    const species = findSpecies("goblinkin");
    const goblin = findLineage("goblinkin", "goblin");
    assert.ok(species);
    assert.ok(goblin);
    assert.equal(resolveSpeciesSize(species, goblin, null), "small");
  });
});
