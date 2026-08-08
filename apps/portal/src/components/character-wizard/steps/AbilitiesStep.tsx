"use client";

/**
 * Schritt „Attribute" — die sechs Zahlen, auf denen alles andere steht.
 *
 * Drei Dinge machen diesen Schritt aus:
 *
 *  1. **Die Methode ist die erste Entscheidung.** Standardwerte, Punktekauf,
 *     Würfeln und Manuell führen zu völlig verschiedenen Oberflächen. Sie
 *     hintereinander in ein Formular zu quetschen, wäre der bequeme Weg und
 *     der schlechtere: Wer würfelt, will Würfel sehen; wer kauft, will das
 *     Budget sehen.
 *  2. **Werte-Pools sind Vertauschungen, keine Zuweisungen.** Standardwerte
 *     und Wurfergebnisse liegen von Anfang an vollständig verteilt. Wer eine
 *     Zahl woanders hin haben will, wählt sie dort aus — der bisherige Inhaber
 *     bekommt im Tausch den alten Wert. Dadurch gibt es keinen halbverteilten
 *     Zwischenzustand, keine „noch 3 offen"-Sackgasse, und die Verteilung
 *     lässt sich aus `base` zurückrechnen. Genau deshalb braucht dieser Schritt
 *     keinen lokalen Spiegel des Entwurfs — was er anzeigt, steht im Entwurf.
 *  3. **Der Hintergrund-Bonus steht hier, nicht beim Hintergrund.** Nach den
 *     Regeln von 2024 kommen die Attributspunkte aus dem Hintergrund
 *     (+2/+1 oder +1/+1/+1 auf dessen drei Attribute). Wer nach „wo verteile
 *     ich meine Punkte" sucht, sucht bei den Attributen.
 *
 * Die Rechnerei liegt vollständig in `@uwe/character-creator`; die Bausteine
 * dieses Schritts in `./abilities/`. Hier steht nur der Ablauf.
 */

import { useState } from "react";
import {
  ABILITIES,
  POINT_BUY_BUDGET,
  STANDARD_ARRAY,
  applyPool,
  canLower,
  canRaise,
  evaluatePointBuy,
  pointBuyCost,
  pointBuyStart,
  pointBuyStepCost,
  rollAbilityScores,
  type AbilityAllocation,
  type AbilityKey,
  type AbilityMethod,
  type AbilityScoreMap,
} from "@uwe/character-creator";

import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { ABILITY_DISPLAY_NAMES } from "./abilities/ability-display";
import { NavIcon } from "@/src/components/ui/icon";
import type { StepProps } from "../types";
import { AbilityLead, AbilityResult, BonusCell } from "./abilities/AbilityRow";
import { BackgroundBonus } from "./abilities/BackgroundBonus";
import { DicePanel, type DiceState } from "./abilities/DicePanel";
import {
  MANUAL_START,
  METHODS,
  deriveAssignment,
  motionDisabled,
  orderedAssignment,
  poolFor,
  recommendedOrder,
} from "./abilities/rules";

export function AbilitiesStep({ draft, set, resolved, validation, goTo }: StepProps) {
  const [dice, setDice] = useState<DiceState | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const allocation = draft.abilities;
  const method = allocation?.method ?? null;
  const base = allocation?.base ?? null;
  const bonus = allocation?.backgroundBonus ?? {};
  const pool = poolFor(allocation);
  const assignment = deriveAssignment(pool, base);

  function writeAllocation(next: AbilityAllocation) {
    setNote(null);
    set("abilities", next);
  }

  function writeBase(nextBase: AbilityScoreMap) {
    if (!allocation) return;
    writeAllocation({ ...allocation, base: nextBase });
  }

  function chooseMethod(next: AbilityMethod) {
    if (next === method) return;
    // Der Hintergrund-Bonus überlebt den Methodenwechsel: Er hängt am
    // Hintergrund, nicht daran, wie die Grundwerte entstanden sind.
    const keptBonus = allocation?.backgroundBonus ?? {};
    if (next === "point_buy") {
      writeAllocation({ method: next, base: pointBuyStart(), backgroundBonus: keptBonus });
      return;
    }
    if (next === "manual") {
      writeAllocation({ method: next, base: { ...MANUAL_START }, backgroundBonus: keptBonus });
      return;
    }
    if (next === "standard_array") {
      writeAllocation({
        method: next,
        base: applyPool(STANDARD_ARRAY, orderedAssignment(STANDARD_ARRAY)),
        backgroundBonus: keptBonus,
      });
      return;
    }
    // Würfeln: Werte entstehen erst mit dem Wurf.
    setDice(null);
    writeAllocation({ method: next, base: pointBuyStart(), backgroundBonus: keptBonus, rolled: [] });
  }

  function rollNow() {
    const rolls = rollAbilityScores(() => Math.random());
    const totals = rolls.map((entry) => entry.total);
    setDice((current) => ({
      rolls,
      nonce: (current?.nonce ?? 0) + 1,
      animate: !motionDisabled(),
    }));
    writeAllocation({
      method: "roll",
      base: applyPool(totals, orderedAssignment(totals)),
      backgroundBonus: allocation?.backgroundBonus ?? {},
      rolled: totals,
    });
  }

  /** Poolwert auf ein Attribut legen — der bisherige Inhaber tauscht mit. */
  function assignFromPool(ability: AbilityKey, index: number) {
    const next = { ...assignment };
    const previous = next[ability];
    const holder = ABILITIES.find((other) => other !== ability && next[other] === index);
    next[ability] = index;
    if (holder !== undefined && previous !== undefined) next[holder] = previous;
    writeBase(applyPool(pool, next));
  }

  function applyRecommendation() {
    const sorted = pool.map((value, index) => ({ value, index })).sort((a, b) => b.value - a.value);
    const next: Partial<Record<AbilityKey, number>> = {};
    recommendedOrder(resolved.dndClass).forEach((ability, position) => {
      const slot = sorted[position];
      if (slot) next[ability] = slot.index;
    });
    writeBase(applyPool(pool, next));
    setNote(
      resolved.dndClass
        ? `Verteilt nach ${resolved.dndClass.name}: die höchsten Werte liegen jetzt auf den Attributen, die diese Klasse trägt.`
        : "Absteigend verteilt. Sobald eine Klasse gewählt ist, richtet sich die Empfehlung nach ihr.",
    );
  }

  function stepPointBuy(ability: AbilityKey, delta: 1 | -1) {
    if (!base) return;
    writeBase({ ...base, [ability]: base[ability] + delta });
  }

  function setManual(ability: AbilityKey, raw: string) {
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return;
    writeBase({ ...(base ?? MANUAL_START), [ability]: Math.min(20, Math.max(1, parsed)) });
  }

  const buy = base ? evaluatePointBuy(base) : null;
  const spentPercent = buy ? Math.round((buy.spent / POINT_BUY_BUDGET) * 100) : 0;
  const rowsReady = base !== null && (method !== "roll" || pool.length === 6);

  return (
    <div className="grid gap-6">
      {/* ── Methode ─────────────────────────────────────────────────── */}
      <section aria-labelledby="cw-ab-method">
        <h3 id="cw-ab-method">Wie entstehen deine Werte?</h3>
        <p className="cw-prose">
          Vier Wege zu denselben sechs Zahlen. Die Wahl lässt sich jederzeit ändern — nur die Werte
          selbst beginnen dann von vorn.
        </p>
        <div className="cw-grid" role="group" aria-label="Methode für die Attributswerte">
          {METHODS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              className="cw-tile"
              aria-pressed={method === entry.key}
              onClick={() => chooseMethod(entry.key)}
            >
              <span className="cw-tile__check" aria-hidden="true">
                <NavIcon name="check" width={16} height={16} />
              </span>
              <span className="cw-tile__name">
                <NavIcon name={entry.icon} width={18} height={18} /> {entry.name}
              </span>
              <span className="cw-tile__hook">{entry.hook}</span>
              <span className="cw-tile__meta">
                <span className="cw-chip">{entry.meta}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Werte ───────────────────────────────────────────────────── */}
      {method === null ? (
        <p className="cw-prose">
          Wähle oben eine Methode. Danach stehen hier deine sechs Werte samt Modifikatoren.
        </p>
      ) : (
        <section aria-labelledby="cw-ab-values" className="grid gap-3">
          <h3 id="cw-ab-values">Deine sechs Werte</h3>

          {method === "point_buy" && buy ? (
            <div className="cw-budget" aria-live="polite">
              <span className="cw-budget__value" data-exhausted={buy.remaining === 0}>
                {buy.remaining}
              </span>
              <span className="uwe-field__hint">von {POINT_BUY_BUDGET} Punkten übrig</span>
              <span
                className="cw-budget__bar"
                role="img"
                aria-label={`${buy.spent} von ${POINT_BUY_BUDGET} Punkten ausgegeben`}
              >
                {/* Die Breite ist Messwert, kein Stil — sie kann nur hier entstehen. */}
                <span className="cw-budget__fill" style={{ width: `${spentPercent}%` }} />
              </span>
            </div>
          ) : null}

          {method === "roll" ? (
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={rollNow}>
                  <NavIcon name="dices" width={16} height={16} />
                  {pool.length === 6 ? "Neu würfeln" : "Sechsmal 4W6 würfeln"}
                </Button>
                {pool.length === 6 ? (
                  <span className="uwe-field__hint">
                    Ein neuer Wurf ersetzt alle sechs Ergebnisse.
                  </span>
                ) : null}
              </div>

              {dice ? (
                <DicePanel dice={dice} />
              ) : pool.length === 6 ? (
                <p className="uwe-field__hint">
                  Gewürfelt in einer früheren Sitzung: {pool.join(" · ")}. Die Würfel selbst zeigt
                  erst der nächste Wurf wieder.
                </p>
              ) : (
                <p className="cw-prose">
                  Noch nichts gewürfelt. Jeder Wurf sind vier sechsseitige Würfel; der kleinste
                  fällt weg, die übrigen drei ergeben den Wert.
                </p>
              )}
            </div>
          ) : null}

          {pool.length > 0 ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" onClick={applyRecommendation}>
                <NavIcon name="wand-sparkles" width={16} height={16} />
                Für mich verteilen
              </Button>
              <span className="uwe-field__hint">
                Jedes Feld unten tauscht seine Zahl mit dem Attribut, das sie gerade hält.
              </span>
            </div>
          ) : null}

          {rowsReady && base
            ? ABILITIES.map((ability) => {
                const controlId = `cw-ability-${ability}`;
                const value = base[ability];
                const extra = bonus[ability] ?? 0;
                return (
                  <div className="cw-buy-row" key={ability}>
                    <AbilityLead
                      ability={ability}
                      controlId={method === "point_buy" ? null : controlId}
                      resolved={resolved}
                    />

                    {method === "point_buy" ? (
                      <span className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label={`${ABILITY_DISPLAY_NAMES[ability]} senken`}
                          disabled={!canLower(base, ability)}
                          onClick={() => stepPointBuy(ability, -1)}
                        >
                          <NavIcon name="minus" width={16} height={16} />
                        </Button>
                        {/* `grid` stapelt Wert und Schrittkosten — nebeneinander
                            läse sich „13 +1 kostet 2" wie eine Rechnung. */}
                        <span className="grid text-center">
                          <span
                            className="cw-budget__value"
                            title={`Dieser Wert kostet ${pointBuyCost(value) ?? 0} von ${POINT_BUY_BUDGET} Punkten.`}
                          >
                            {value}
                          </span>
                          <span className="uwe-field__hint">
                            {pointBuyStepCost(value) === null
                              ? "Höchstwert"
                              : `+1 kostet ${pointBuyStepCost(value)}`}
                          </span>
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label={`${ABILITY_DISPLAY_NAMES[ability]} erhöhen`}
                          disabled={!canRaise(base, ability)}
                          onClick={() => stepPointBuy(ability, 1)}
                        >
                          <NavIcon name="plus" width={16} height={16} />
                        </Button>
                      </span>
                    ) : method === "manual" ? (
                      <Input
                        id={controlId}
                        className="w-20"
                        type="number"
                        min={1}
                        max={20}
                        inputMode="numeric"
                        value={value}
                        onChange={(event) => setManual(ability, event.target.value)}
                      />
                    ) : (
                      <select
                        id={controlId}
                        className="uwe-input-v3"
                        value={assignment[ability] ?? ""}
                        onChange={(event) =>
                          assignFromPool(ability, Number.parseInt(event.target.value, 10))
                        }
                      >
                        {pool.map((poolValue, poolIndex) => (
                          <option key={`${poolIndex}-${poolValue}`} value={poolIndex}>
                            {poolValue}
                          </option>
                        ))}
                      </select>
                    )}

                    <BonusCell ability={ability} value={extra} />
                    <AbilityResult total={Math.min(20, value + extra)} />
                  </div>
                );
              })
            : null}

          {buy && method === "point_buy" && !buy.valid ? (
            <p className="cw-footer__hint" data-tone="blocked">
              Diese Verteilung passt nicht in den Punktekauf — erlaubt sind Werte von 8 bis 15
              innerhalb von {POINT_BUY_BUDGET} Punkten.
            </p>
          ) : null}
        </section>
      )}

      <BackgroundBonus
        background={resolved.background}
        base={base}
        bonus={bonus}
        hasAllocation={allocation !== null}
        onChange={(next) => {
          if (!allocation) return;
          writeAllocation({ ...allocation, backgroundBonus: next });
        }}
        goTo={goTo}
      />

      <p className="cw-footer__hint" role="status">
        {note ?? (validation.complete ? "Attribute stehen." : (validation.issues[0] ?? ""))}
      </p>

      <details className="cw-disclosure">
        <summary>Wie die vier Wege sich unterscheiden</summary>
        <div className="cw-prose">
          <p>
            <strong>Standardwerte</strong> geben allen am Tisch dieselbe Ausgangslage — die fairste
            Wahl, wenn niemand Lust auf Rechnen hat. <strong>Punktekauf</strong> ist dasselbe mit
            Feinsteuerung: Man kann sich eine 15 leisten, zahlt sie aber mit zwei Achten. Die
            Kostentreppe ist kein Schikane-Detail, sondern der Grund, warum kein Charakter überall
            gut ist.
          </p>
          <p>
            <strong>Würfeln</strong> ist die einzige Methode mit echtem Risiko: vier Würfel, der
            kleinste fällt weg, sechsmal hintereinander. Das kann Werte ergeben, die kein
            Punktekauf hergibt — und Werte, mit denen man leben muss. <strong>Manuell</strong> hat
            keine Regel, sondern eine Absprache: Was hier steht, hat die Spielleitung so bestimmt.
          </p>
          <p>
            Auf alle vier kommt zuletzt der Hintergrund-Bonus. Er ist gedeckelt: Über 20 geht auf
            Stufe 1 nichts.
          </p>
        </div>
      </details>
    </div>
  );
}
