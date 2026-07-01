import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  analyzeEncounterXp,
  getEncounterBudgetThresholds,
  xpForChallengeRating,
} from "./encounter-xp-budget";

describe("encounter xp budget", () => {
  it("maps challenge ratings to xp", () => {
    assert.equal(xpForChallengeRating("1/2"), 100);
    assert.equal(xpForChallengeRating("5"), 1800);
  });

  it("computes party budget thresholds", () => {
    const thresholds = getEncounterBudgetThresholds(5, 4);
    assert.equal(thresholds.medium, 2000);
    assert.equal(thresholds.deadly, 4400);
  });

  it("classifies encounter difficulty for level 5 party", () => {
    const analysis = analyzeEncounterXp({
      partyLevel: 5,
      partySize: 4,
      monsters: [{ cr: "2", count: 2 }],
    });

    assert.equal(analysis.rawXp, 900);
    assert.equal(analysis.multiplier, 1.5);
    assert.equal(analysis.adjustedXp, 1350);
    assert.equal(analysis.difficulty, "easy");
  });

  it("detects deadly encounter when budget exceeded", () => {
    const analysis = analyzeEncounterXp({
      partyLevel: 5,
      partySize: 4,
      monsters: [{ cr: "5", count: 3 }],
    });

    assert.equal(analysis.difficulty, "deadly");
  });
});
