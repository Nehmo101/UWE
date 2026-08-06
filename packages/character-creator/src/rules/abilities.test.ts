import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyPool,
  canLower,
  canRaise,
  evaluatePointBuy,
  formatModifier,
  isPoolFullyAssigned,
  POINT_BUY_BUDGET,
  pointBuyCost,
  pointBuyStart,
  pointBuyStepCost,
  rollAbilityScores,
  rollOnce,
  STANDARD_ARRAY,
  totalScores,
} from "./abilities";
import type { AbilityScoreMap } from "../types";

/** Ein Zufallsgenerator, der eine feste Folge abspielt — Würfe sind so prüfbar. */
function sequence(values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index % values.length];
    index += 1;
    return value;
  };
}

describe("Punktekauf", () => {
  it("beginnt bei acht überall und vollem Budget", () => {
    const state = evaluatePointBuy(pointBuyStart());
    assert.equal(state.spent, 0);
    assert.equal(state.remaining, POINT_BUY_BUDGET);
    assert.equal(state.valid, true);
  });

  it("kennt die Kostentabelle des Spielerhandbuchs", () => {
    assert.equal(pointBuyCost(8), 0);
    assert.equal(pointBuyCost(13), 5);
    // Der Sprung auf 14 und 15 kostet doppelt — das ist der eigentliche Trade-off.
    assert.equal(pointBuyCost(14), 7);
    assert.equal(pointBuyCost(15), 9);
    assert.equal(pointBuyCost(16), null);
    assert.equal(pointBuyCost(7), null);
  });

  it("rechnet die Schrittkosten aus der Tabelle, nicht aus einer Formel", () => {
    assert.equal(pointBuyStepCost(13), 2);
    assert.equal(pointBuyStepCost(14), 2);
    assert.equal(pointBuyStepCost(8), 1);
    assert.equal(pointBuyStepCost(15), null);
  });

  it("erkennt eine ausgereizte Verteilung als gültig", () => {
    // 15/15/15/8/8/8 = 9+9+9 = 27 — genau das Budget.
    const scores: AbilityScoreMap = {
      strength: 15,
      dexterity: 15,
      constitution: 15,
      intelligence: 8,
      wisdom: 8,
      charisma: 8,
    };
    const state = evaluatePointBuy(scores);
    assert.equal(state.spent, 27);
    assert.equal(state.remaining, 0);
    assert.equal(state.valid, true);
  });

  it("verweigert das Anheben, wenn das Restbudget nicht reicht", () => {
    const scores: AbilityScoreMap = {
      strength: 15,
      dexterity: 15,
      constitution: 15,
      intelligence: 8,
      wisdom: 8,
      charisma: 8,
    };
    assert.equal(canRaise(scores, "intelligence"), false);
    assert.equal(canRaise(scores, "strength"), false, "15 ist die Obergrenze");
    assert.equal(canLower(scores, "strength"), true);
    assert.equal(canLower(scores, "intelligence"), false, "8 ist die Untergrenze");
  });

  it("meldet Werte außerhalb der Spanne statt sie stillschweigend zu zählen", () => {
    const scores: AbilityScoreMap = {
      strength: 18,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    };
    const state = evaluatePointBuy(scores);
    assert.deepEqual(state.outOfRange, ["strength"]);
    assert.equal(state.valid, false);
  });
});

describe("Würfeln", () => {
  it("lässt den kleinsten der vier Würfel fallen", () => {
    // random() = 0 -> 1, 0.99 -> 6. Folge: 6,6,6,1
    const roll = rollOnce(sequence([0.99, 0.99, 0.99, 0]));
    assert.deepEqual(roll.dice, [6, 6, 6, 1]);
    assert.equal(roll.dropped, 1);
    assert.equal(roll.total, 18);
  });

  it("liefert sechs Würfe in Wurfreihenfolge", () => {
    const rolls = rollAbilityScores(sequence([0.5]));
    assert.equal(rolls.length, 6);
    for (const roll of rolls) {
      assert.equal(roll.dice.length, 4);
      assert.ok(roll.total >= 3 && roll.total <= 18);
    }
  });

  it("bleibt bei gleichem Zufall reproduzierbar", () => {
    const a = rollAbilityScores(sequence([0.1, 0.9, 0.4, 0.7]));
    const b = rollAbilityScores(sequence([0.1, 0.9, 0.4, 0.7]));
    assert.deepEqual(a, b);
  });
});

describe("Werte zuordnen", () => {
  it("füllt nicht zugewiesene Attribute mit dem Mindestwert statt NaN", () => {
    const scores = applyPool(STANDARD_ARRAY, { strength: 0, dexterity: 1 });
    assert.equal(scores.strength, 15);
    assert.equal(scores.dexterity, 14);
    assert.equal(scores.charisma, 8, "unzugewiesen fällt auf den Rückfallwert");
  });

  it("erkennt eine vollständige Zuordnung", () => {
    const complete = {
      strength: 0,
      dexterity: 1,
      constitution: 2,
      intelligence: 3,
      wisdom: 4,
      charisma: 5,
    };
    assert.equal(isPoolFullyAssigned(STANDARD_ARRAY, complete), true);
  });

  it("erkennt doppelt vergebene Poolplätze", () => {
    const duplicate = {
      strength: 0,
      dexterity: 0,
      constitution: 2,
      intelligence: 3,
      wisdom: 4,
      charisma: 5,
    };
    assert.equal(isPoolFullyAssigned(STANDARD_ARRAY, duplicate), false);
  });
});

describe("Summen und Anzeige", () => {
  it("legt den Hintergrund-Bonus auf die Grundwerte", () => {
    const base: AbilityScoreMap = {
      strength: 15,
      dexterity: 13,
      constitution: 14,
      intelligence: 10,
      wisdom: 12,
      charisma: 8,
    };
    const total = totalScores(base, { strength: 2, constitution: 1 });
    assert.equal(total.strength, 17);
    assert.equal(total.constitution, 15);
    assert.equal(total.dexterity, 13);
  });

  it("deckelt bei 20 — auf Stufe 1 ist darüber nichts vorgesehen", () => {
    const base: AbilityScoreMap = {
      strength: 19,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    };
    assert.equal(totalScores(base, { strength: 2 }).strength, 20);
  });

  it("schreibt Modifikatoren mit Vorzeichen", () => {
    assert.equal(formatModifier(3), "+3");
    assert.equal(formatModifier(0), "+0");
    assert.equal(formatModifier(-1), "-1");
  });
});
