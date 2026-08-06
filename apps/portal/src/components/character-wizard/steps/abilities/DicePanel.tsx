"use client";

/**
 * Der Würfelwurf — die einzige Stelle im Ersteller, an der Bewegung etwas
 * erklärt statt nur zu schmücken.
 *
 * Zwei Entscheidungen, die man beim Nachbauen leicht anders träfe:
 *
 *  1. **Der gestrichene Würfel bleibt liegen.** 4W6 heißt: vier Würfel, der
 *     kleinste zählt nicht. Wer nur die drei zählenden zeigt, behauptet ein
 *     Ergebnis. `data-dropped` blasst ihn ab, streicht ihn durch und lässt die
 *     Kante gestrichelt — sichtbar, aber erkennbar draußen.
 *  2. **Die Animation läuft ohne Zeitschaltung.** `data-rolling` wird nicht
 *     nach n Millisekunden zurückgenommen; stattdessen bekommt jeder Würfel
 *     einen Schlüssel mit der Wurfnummer. Ein neuer Wurf hängt neue Elemente
 *     ein, und die CSS-Animation startet von selbst. Damit gibt es kein
 *     `setTimeout`, keinen hängenden Zustand und — wichtiger — keinen Weg, wie
 *     die Abschaltung der Bewegung die Würfel im Zwischenzustand einfrieren
 *     könnte: Ist Bewegung aus, wird `data-rolling` gar nicht erst gesetzt und
 *     die Würfel liegen im ersten Frame fertig da.
 */

import type { AbilityRoll } from "@uwe/character-creator";

import { describeRoll } from "./rules";

export interface DiceState {
  rolls: AbilityRoll[];
  /** Hochzählen erzwingt neue Schlüssel — nur so läuft die CSS-Animation erneut. */
  nonce: number;
  /** Bei abgeschalteter Bewegung bleibt `data-rolling` weg. */
  animate: boolean;
}

export function DicePanel({ dice }: { dice: DiceState }) {
  return (
    <div className="grid gap-2">
      {dice.rolls.map((roll, rollIndex) => {
        // Bei zwei gleichen Kleinsten fällt genau einer weg, nicht beide.
        let droppedTaken = false;
        return (
          <div
            key={`${dice.nonce}-${rollIndex}`}
            className="flex flex-wrap items-center gap-2"
            role="img"
            aria-label={describeRoll(roll, rollIndex)}
          >
            <span className="cw-dice" aria-hidden="true">
              {roll.dice.map((value, dieIndex) => {
                const dropped = !droppedTaken && value === roll.dropped;
                if (dropped) droppedTaken = true;
                return (
                  <span
                    key={`${dice.nonce}-${rollIndex}-${dieIndex}`}
                    className="cw-die"
                    data-dropped={dropped ? "true" : undefined}
                    data-rolling={dice.animate ? "true" : undefined}
                  >
                    {value}
                  </span>
                );
              })}
            </span>
            <span className="cw-chip" data-tone="accent" aria-hidden="true">
              Wurf {rollIndex + 1}
              <span className="cw-chip__value">{roll.total}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
