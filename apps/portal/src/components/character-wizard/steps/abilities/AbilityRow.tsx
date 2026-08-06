"use client";

/**
 * Die drei festen Zellen einer Attributszeile.
 *
 * `.cw-buy-row` ist ein Raster aus vier Spalten (`1fr auto auto auto`). Drei
 * davon sehen in allen vier Methoden gleich aus — Name links, Hintergrund-Bonus
 * in der Mitte, Ergebnis rechts. Nur die zweite Spalte, das eigentliche
 * Bedienelement, unterscheidet sich. Genau diese Aufteilung steckt hier:
 * gleiche Kennzahl an gleicher Stelle, damit man sechs Zeilen untereinander
 * lesen kann, ohne jedes Mal neu zu suchen.
 */

import {
  ABILITY_HINTS,
  ABILITY_LABELS,
  ABILITY_SHORT,
  abilityModifier,
  formatModifier,
  type AbilityKey,
} from "@uwe/character-creator";

import type { ResolvedCatalog } from "../../types";
import { relevanceFor } from "./rules";

/**
 * Linke Spalte: Name, Halbsatz, wer sich für dieses Attribut interessiert.
 *
 * `controlId` ist `null`, wenn die Zeile kein beschriftbares Feld hat — beim
 * Punktekauf steht dort ein Zahlenfeld aus zwei Knöpfen, und ein `<label for>`
 * auf ein `<span>` wäre eine Beziehung, die es im Browser nicht gibt. Die
 * beiden Knöpfe tragen ihre Beschriftung dann selbst.
 */
export function AbilityLead({
  ability,
  controlId,
  resolved,
}: {
  ability: AbilityKey;
  controlId: string | null;
  resolved: ResolvedCatalog;
}) {
  const marks = relevanceFor(ability, resolved);
  const caption = (
    <>
      {ABILITY_LABELS[ability]} <span className="cw-ability__short">({ABILITY_SHORT[ability]})</span>
    </>
  );
  return (
    // `min-w-0` erlaubt der 1fr-Spalte, unter ihre Mindestbreite zu schrumpfen;
    // ohne das schiebt der längste Halbsatz auf dem Telefon die Seite auf.
    <div className="min-w-0 break-words">
      {controlId ? (
        <label className="uwe-field__label" htmlFor={controlId}>
          {caption}
        </label>
      ) : (
        <span className="uwe-field__label">{caption}</span>
      )}
      <p className="uwe-field__hint">{ABILITY_HINTS[ability]}</p>
      {marks.length > 0 ? (
        <span className="cw-tile__meta">
          {marks.map((mark) => (
            <span
              key={mark.label}
              className="cw-chip"
              data-tone={mark.accent ? "accent" : undefined}
              title={mark.title}
            >
              {mark.label}
            </span>
          ))}
        </span>
      ) : null}
    </div>
  );
}

/** Dritte Spalte: was der Hintergrund auf diesen Wert legt. */
export function BonusCell({ ability, value }: { ability: AbilityKey; value: number }) {
  // Leerer Platzhalter statt „+0" — sechsmal eine Null wäre Rauschen, aber die
  // Zelle muss bleiben, sonst rutscht das Raster.
  if (value <= 0) return <span aria-hidden="true" />;
  return (
    <span
      className="cw-chip"
      data-tone="accent"
      title={`Hintergrund-Bonus auf ${ABILITY_LABELS[ability]}`}
    >
      +{value}
    </span>
  );
}

/** Rechte Spalte: der Wert, der am Ende auf dem Bogen steht. */
export function AbilityResult({ total }: { total: number }) {
  return (
    <span className="cw-ability">
      <span className="cw-ability__mod">{formatModifier(abilityModifier(total))}</span>
      <span className="cw-ability__score">{total}</span>
    </span>
  );
}
