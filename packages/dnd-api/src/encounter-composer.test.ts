import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  challengeRatingForXp,
  suggestCandidateChallengeRatings,
  suggestEncounterComposition,
  type EncounterCandidate,
} from "./encounter-composer";
import { getEncounterBudgetThresholds } from "./encounter-xp-budget";

const CANDIDATES: EncounterCandidate[] = [
  { name: "Goblin", slug: "goblin", cr: "1/4" },
  { name: "Hobgoblin", slug: "hobgoblin", cr: "1/2" },
  { name: "Oger", slug: "ogre", cr: "2" },
  { name: "Eulenbär", slug: "owlbear", cr: "3" },
  { name: "Troll", slug: "troll", cr: "5" },
  { name: "Junger Drache", slug: "young-dragon", cr: "8" },
];

const firstPick = () => 0;

describe("encounter composer", () => {
  it("maps XP amounts to the largest fitting CR", () => {
    assert.equal(challengeRatingForXp(10), "0");
    assert.equal(challengeRatingForXp(199), "1/2");
    assert.equal(challengeRatingForXp(450), "2");
    assert.equal(challengeRatingForXp(999999), "20");
  });

  it("suggests deduplicated candidate CR buckets ordered high to low", () => {
    const crs = suggestCandidateChallengeRatings(5, 4, "hard");
    assert.ok(crs.length >= 2);
    for (let i = 1; i < crs.length; i += 1) {
      assert.notEqual(crs[i], crs[i - 1]);
    }
  });

  it("fills the budget into the target band without crossing the cap", () => {
    const composition = suggestEncounterComposition({
      partyLevel: 5,
      partySize: 4,
      difficulty: "medium",
      style: "mixed",
      candidates: CANDIDATES,
      random: firstPick,
    });

    const thresholds = getEncounterBudgetThresholds(5, 4);
    assert.ok(composition.entries.length > 0);
    assert.ok(composition.analysis.adjustedXp <= composition.capXp);
    assert.ok(composition.analysis.adjustedXp >= thresholds.easy);
    assert.equal(composition.targetXp, thresholds.medium);
  });

  it("boss style picks a single strong monster first", () => {
    const composition = suggestEncounterComposition({
      partyLevel: 5,
      partySize: 4,
      difficulty: "deadly",
      style: "boss",
      candidates: CANDIDATES,
      random: firstPick,
    });

    assert.ok(composition.entries.length >= 1);
    const lead = composition.entries[0]!;
    assert.ok(["troll", "young-dragon", "owlbear"].includes(lead.monster.slug));
  });

  it("horde style stacks one low-CR monster type", () => {
    const composition = suggestEncounterComposition({
      partyLevel: 5,
      partySize: 4,
      difficulty: "hard",
      style: "horde",
      candidates: CANDIDATES,
      random: firstPick,
    });

    assert.equal(composition.entries.length, 1);
    assert.ok(composition.entries[0]!.count > 1);
  });

  it("returns an empty composition when no candidate fits", () => {
    const composition = suggestEncounterComposition({
      partyLevel: 1,
      partySize: 1,
      difficulty: "easy",
      style: "mixed",
      candidates: [{ name: "Tarrasque", slug: "tarrasque", cr: "30" }],
      random: firstPick,
    });

    assert.equal(composition.entries.length, 0);
    assert.equal(composition.analysis.adjustedXp, 0);
  });
});
