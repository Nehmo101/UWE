"use client";

/**
 * Der Attributsbonus des Hintergrunds — die Regel von 2024, die Spieler sonst
 * nicht finden.
 *
 * Bis 2014 kamen die Attributspunkte vom Volk. Seit der Fassung von 2024
 * kommen sie vom Hintergrund: Er nennt drei Attribute, der Spieler legt darauf
 * entweder +2 und +1 oder dreimal +1. Wer diesen Block wegließe, hätte einen
 * Ersteller, der regelkonform aussieht und Charaktere mit drei fehlenden
 * Punkten ausspuckt.
 *
 * Die Prüfung macht `isBackgroundBonusValid` aus dem Regelpaket — hier wird
 * nur gefragt und angezeigt, nie nachgerechnet.
 */

import {
  ABILITIES,
  ABILITY_LABELS,
  ABILITY_SHORT,
  abilityModifier,
  formatModifier,
  isBackgroundBonusValid,
  type AbilityKey,
  type AbilityScoreMap,
  type Background,
} from "@uwe/character-creator";

import { Button } from "@/src/components/ui/button";
import { NavIcon } from "@/src/components/ui/icon";

export interface BackgroundBonusProps {
  background: Background | null;
  /** Grundwerte, falls schon eine Methode gewählt ist. */
  base: AbilityScoreMap | null;
  bonus: Partial<Record<AbilityKey, number>>;
  /** Ohne Attributsverteilung gibt es kein Feld, in das der Bonus geschrieben würde. */
  hasAllocation: boolean;
  onChange: (next: Partial<Record<AbilityKey, number>>) => void;
  goTo: (step: string) => void;
}

export function BackgroundBonus({
  background,
  base,
  bonus,
  hasAllocation,
  onChange,
  goTo,
}: BackgroundBonusProps) {
  const options = background?.abilityOptions ?? [];
  const valid = isBackgroundBonusValid(background, bonus);
  const mode = !valid ? null : options.some((ability) => bonus[ability] === 2) ? "two_one" : "spread";
  const primary = options.find((ability) => bonus[ability] === 2) ?? null;
  const secondary = options.find((ability) => bonus[ability] === 1) ?? null;

  function writeTwoOne(nextPrimary: AbilityKey | null, nextSecondary: AbilityKey | null) {
    const next: Partial<Record<AbilityKey, number>> = {};
    if (nextPrimary) next[nextPrimary] = 2;
    if (nextSecondary && nextSecondary !== nextPrimary) next[nextSecondary] = 1;
    onChange(next);
  }

  function chooseSpread() {
    const next: Partial<Record<AbilityKey, number>> = {};
    for (const ability of options) next[ability] = 1;
    onChange(next);
  }

  if (!background) {
    return (
      <section aria-labelledby="cw-ab-bonus" className="grid gap-3">
        <h3 id="cw-ab-bonus">Bonus aus dem Hintergrund</h3>
        <p className="cw-prose">
          Seit den Regeln von 2024 kommen die Attributspunkte nicht mehr vom Volk, sondern vom
          Hintergrund: Er nennt drei Attribute, und du legst darauf entweder +2 und +1 oder dreimal
          +1. Solange kein Hintergrund gewählt ist, bleiben deine Werte roh — drei Punkte fehlen.
        </p>
        <div>
          <Button variant="outline" onClick={() => goTo("background")}>
            <NavIcon name="scroll-text" width={16} height={16} />
            Hintergrund wählen
          </Button>
        </div>
      </section>
    );
  }

  const named = options.map((ability) => ABILITY_LABELS[ability]).join(", ");

  return (
    <section aria-labelledby="cw-ab-bonus" className="grid gap-3">
      <h3 id="cw-ab-bonus">Bonus aus dem Hintergrund</h3>

      {!hasAllocation ? (
        <p className="cw-prose">
          {background.name} hebt {named}. Wähle oben zuerst eine Methode — der Bonus wird auf die
          Grundwerte gerechnet, und die gibt es noch nicht.
        </p>
      ) : (
        <>
          <p className="cw-prose">
            {background.name} erlaubt {named}. Verteile darauf drei Punkte. Über 20 geht auf Stufe
            1 nichts.
          </p>

          <div className="cw-filters" role="group" aria-label="Verteilung des Hintergrund-Bonus">
            <button
              type="button"
              className="cw-filter"
              aria-pressed={mode === "two_one"}
              onClick={() => writeTwoOne(options[0] ?? null, options[1] ?? null)}
            >
              +2 und +1
            </button>
            <button
              type="button"
              className="cw-filter"
              aria-pressed={mode === "spread"}
              onClick={chooseSpread}
            >
              dreimal +1
            </button>
          </div>

          {mode === "two_one" ? (
            <div className="flex flex-wrap gap-4">
              <span className="uwe-field">
                <label className="uwe-field__label" htmlFor="cw-bonus-primary">
                  Attribut mit +2
                </label>
                <select
                  id="cw-bonus-primary"
                  className="uwe-input-v3"
                  value={primary ?? ""}
                  onChange={(event) => {
                    const picked = ABILITIES.find((ability) => ability === event.target.value);
                    if (!picked) return;
                    // Wer die +1 zur +2 macht, bekommt die alte +2 im Tausch —
                    // sonst wäre eine Wahl kurzzeitig ungültig.
                    writeTwoOne(picked, secondary === picked ? primary : secondary);
                  }}
                >
                  {options.map((ability) => (
                    <option key={ability} value={ability}>
                      {ABILITY_LABELS[ability]}
                    </option>
                  ))}
                </select>
              </span>
              <span className="uwe-field">
                <label className="uwe-field__label" htmlFor="cw-bonus-secondary">
                  Attribut mit +1
                </label>
                <select
                  id="cw-bonus-secondary"
                  className="uwe-input-v3"
                  value={secondary ?? ""}
                  onChange={(event) => {
                    const picked = ABILITIES.find((ability) => ability === event.target.value);
                    if (!picked) return;
                    writeTwoOne(primary === picked ? secondary : primary, picked);
                  }}
                >
                  {options.map((ability) => (
                    <option key={ability} value={ability}>
                      {ABILITY_LABELS[ability]}
                    </option>
                  ))}
                </select>
              </span>
            </div>
          ) : null}

          <div className="cw-abilities">
            {options.map((ability) => {
              const extra = bonus[ability] ?? 0;
              const total = Math.min(20, (base?.[ability] ?? 0) + extra);
              return (
                <span key={ability} className="cw-ability" data-boosted={extra > 0}>
                  <span className="cw-ability__short">{ABILITY_SHORT[ability]}</span>
                  <span className="cw-ability__mod">{formatModifier(abilityModifier(total))}</span>
                  <span className="cw-ability__score">
                    {total}
                    {extra > 0 ? ` (+${extra})` : ""}
                  </span>
                </span>
              );
            })}
          </div>

          {!valid ? (
            <p className="cw-footer__hint" data-tone="blocked">
              Noch nicht verteilt: erlaubt sind +2/+1 auf zwei dieser Attribute oder +1/+1/+1 auf
              alle drei.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
