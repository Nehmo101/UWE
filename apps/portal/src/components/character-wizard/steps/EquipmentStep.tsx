"use client";

/**
 * Schritt 6: Startausrüstung.
 *
 * Der SRD stellt eine echte Wahl: ein fertig geschnürtes Paket (A, manchmal
 * auch B) **oder** eine Handvoll Gold, mit der man selbst einkauft. Beides
 * lässt sich nur vergleichen, wenn beides nebeneinander steht und dieselben
 * Kennzahlen an derselben Stelle trägt — Anzahl, Gewicht, Wert, Gold. Genau
 * das machen die Karten hier.
 *
 * Zwei Ehrlichkeiten, die dieser Schritt sich leistet:
 *
 *  - **Gewicht und Wert werden nur behauptet, wo die Daten sie hergeben.**
 *    Die Klassenlisten tragen bei den meisten Zeilen weder `weight` noch
 *    `valueCp`; Pakete lösen wir über `EQUIPMENT_PACKS` auf. Was übrig
 *    bleibt, wird als „mind.“ markiert statt weggerundet.
 *  - **Der Hintergrund steht getrennt.** Seine Ausrüstung ist keine Wahl,
 *    sondern kommt immer dazu. Sie in die Optionskarten zu mischen, würde
 *    den Vergleich verfälschen.
 */

import { useState } from "react";
import {
  ARMOR,
  EQUIPMENT_PACKS,
  WEAPONS,
  type EquipmentLine,
  type EquipmentOption,
  type EquipmentPack,
} from "@uwe/character-creator";

import { Button } from "@/src/components/ui/button";
import { NavIcon } from "@/src/components/ui/icon";
import type { StepProps } from "../types";

/** Schlüssel im Entwurf für „ich nehme lieber das Gold“. */
const GOLD_CHOICE = "gold";

/**
 * Pakete stehen in den Klassenlisten unter ihrem Anzeigenamen
 * („Entdeckerpaket“), nicht unter ihrem Schlüssel — `findPack` hilft hier
 * also nicht. Der Abgleich läuft deshalb über Name und englischen Namen.
 */
function packFor(name: string): EquipmentPack | undefined {
  return EQUIPMENT_PACKS.find((pack) => pack.name === name || pack.nameEn === name);
}

/**
 * Waffen- und Rüstungstabelle in einem Nachschlagewerk. Die Klassenlisten
 * nennen nur Name und Menge — Gewicht, Preis und die Kampfnotiz („1W12 Hieb,
 * Schwer, Zweihändig") stehen erst hier. Genau die machen zwei Optionen
 * vergleichbar.
 */
const GEAR: readonly EquipmentLine[] = [...WEAPONS, ...ARMOR];

function gearFor(name: string): EquipmentLine | undefined {
  return GEAR.find((entry) => entry.name === name);
}

/** Gewicht einer Zeile in Pfund — `null`, wenn der Katalog nichts hergibt. */
function lineWeight(line: EquipmentLine): number | null {
  if (typeof line.weight === "number") return line.weight;
  const gear = gearFor(line.name);
  if (gear && typeof gear.weight === "number") return gear.weight;
  const pack = packFor(line.name);
  if (!pack) return null;
  let sum = 0;
  let known = false;
  for (const item of pack.items) {
    const itemWeight = typeof item.weight === "number" ? item.weight : gearFor(item.name)?.weight;
    if (typeof itemWeight === "number") {
      sum += itemWeight * item.quantity;
      known = true;
    }
  }
  return known ? sum : null;
}

/** Wert einer Zeile in Kupfermünzen — `null`, wenn unbekannt. */
function lineValueCp(line: EquipmentLine): number | null {
  if (typeof line.valueCp === "number") return line.valueCp;
  const gear = gearFor(line.name);
  if (gear && typeof gear.valueCp === "number") return gear.valueCp;
  const pack = packFor(line.name);
  return pack ? pack.costGp * 100 : null;
}

/** Die Notiz zur Zeile: eigene zuerst, sonst die aus der Waffentabelle. */
function lineNote(line: EquipmentLine): string | null {
  if (line.notes) return line.notes;
  return gearFor(line.name)?.notes ?? null;
}

interface Totals {
  pieces: number;
  weight: number;
  weightKnown: boolean;
  weightComplete: boolean;
  valueCp: number;
  valueKnown: boolean;
  valueComplete: boolean;
}

function sumTotals(items: readonly EquipmentLine[], goldGp: number): Totals {
  let weight = 0;
  let valueCp = goldGp * 100;
  let weightKnown = false;
  let weightComplete = true;
  let valueKnown = goldGp > 0;
  let valueComplete = true;
  let pieces = 0;

  for (const line of items) {
    pieces += line.quantity;
    const perPieceWeight = lineWeight(line);
    if (perPieceWeight === null) {
      weightComplete = false;
    } else {
      weight += perPieceWeight * line.quantity;
      weightKnown = true;
    }
    const perPieceValue = lineValueCp(line);
    if (perPieceValue === null) {
      valueComplete = false;
    } else {
      valueCp += perPieceValue * line.quantity;
      valueKnown = true;
    }
  }

  return {
    pieces,
    weight,
    weightKnown,
    weightComplete,
    valueCp,
    valueKnown,
    valueComplete,
  };
}

/** Kupfer in GM/SM/KM — die Schreibweise vom Charakterbogen. */
function formatCoins(cp: number): string {
  const gold = Math.floor(cp / 100);
  const silver = Math.floor((cp % 100) / 10);
  const copper = cp % 10;
  const parts: string[] = [];
  if (gold > 0) parts.push(`${gold} GM`);
  if (silver > 0) parts.push(`${silver} SM`);
  if (copper > 0) parts.push(`${copper} KM`);
  return parts.length > 0 ? parts.join(" ") : "0 GM";
}

/** Ohne `toLocaleString`, damit Server- und Client-Ausgabe garantiert gleich sind. */
function formatWeight(pounds: number): string {
  const rounded = Math.round(pounds * 10) / 10;
  return String(rounded).replace(".", ",");
}

/** Die immer gleiche Kennzahlenreihe — nur so sind zwei Karten vergleichbar. */
function TotalsChips({ totals }: { totals: Totals }) {
  return (
    <span className="cw-tile__meta">
      <span className="cw-chip">
        Stücke <span className="cw-chip__value">{totals.pieces}</span>
      </span>
      {totals.weightKnown ? (
        <span className="cw-chip">
          Gewicht{" "}
          <span className="cw-chip__value">
            {totals.weightComplete ? "" : "mind. "}
            {formatWeight(totals.weight)}
          </span>{" "}
          Pfund
        </span>
      ) : (
        <span className="cw-chip">Gewicht nicht erfasst</span>
      )}
      {totals.valueKnown ? (
        <span className="cw-chip">
          Wert{" "}
          <span className="cw-chip__value">
            {totals.valueComplete ? "" : "mind. "}
            {formatCoins(totals.valueCp)}
          </span>
        </span>
      ) : (
        <span className="cw-chip">Wert nicht erfasst</span>
      )}
    </span>
  );
}

interface OptionCardProps {
  option: EquipmentOption;
  selected: boolean;
  onSelect: () => void;
}

function OptionCard({ option, selected, onSelect }: OptionCardProps) {
  const totals = sumTotals(option.items, option.gold);
  const packs = option.items
    .map((line) => packFor(line.name))
    .filter((pack): pack is EquipmentPack => pack !== undefined);

  return (
    <div className="cw-choice">
      <button type="button" className="cw-tile" aria-pressed={selected} onClick={onSelect}>
        <span className="cw-tile__check" aria-hidden="true">
          <NavIcon name="check" width={16} height={16} />
        </span>
        <span className="cw-tile__name">{option.label}</span>

        <span className="cw-items">
          {option.items.map((line) => {
            const note = lineNote(line);
            return (
              <span key={`${line.name}-${line.quantity}`} className="cw-item">
                <span className="cw-item__qty">{line.quantity}×</span>
                <span className="cw-item__name">
                  {line.name}
                  {note ? <span className="cw-item__note"> — {note}</span> : null}
                </span>
              </span>
            );
          })}
          {option.gold > 0 ? (
            <span className="cw-item">
              <span className="cw-item__qty">+</span>
              <span className="cw-item__name">{option.gold} GM in der Börse</span>
            </span>
          ) : null}
        </span>

        <TotalsChips totals={totals} />
      </button>

      {packs.length > 0 ? (
        <details className="cw-disclosure">
          <summary>Was in den Paketen steckt</summary>
          {packs.map((pack) => (
            <div key={pack.key}>
              <p className="cw-prose">
                {pack.name} — {pack.costGp} GM. {pack.hook}
              </p>
              <ul className="cw-items">
                {pack.items.map((item) => (
                  <li key={item.name} className="cw-item">
                    <span className="cw-item__qty">{item.quantity}×</span>
                    <span className="cw-item__name">{item.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </details>
      ) : null}
    </div>
  );
}

interface GoldCardProps {
  gold: number;
  selected: boolean;
  onSelect: () => void;
}

function GoldCard({ gold, selected, onSelect }: GoldCardProps) {
  return (
    <div className="cw-choice">
      <button type="button" className="cw-tile" aria-pressed={selected} onClick={onSelect}>
        <span className="cw-tile__check" aria-hidden="true">
          <NavIcon name="check" width={16} height={16} />
        </span>
        <span className="cw-tile__name">Stattdessen Gold</span>
        <span className="cw-tile__hook">
          Du ziehst mit leeren Taschen und vollem Beutel los und kaufst alles selbst
          ein — mehr Arbeit vor dem ersten Abend, dafür genau die Ausrüstung, die du
          willst.
        </span>

        <span className="cw-items">
          <span className="cw-item">
            <span className="cw-item__qty">+</span>
            <span className="cw-item__name">{gold} GM Startgold</span>
          </span>
        </span>

        <span className="cw-tile__meta">
          <span className="cw-chip">
            Stücke <span className="cw-chip__value">0</span>
          </span>
          <span className="cw-chip">
            Gewicht <span className="cw-chip__value">0</span> Pfund
          </span>
          <span className="cw-chip">
            Wert <span className="cw-chip__value">{gold} GM</span>
          </span>
        </span>
      </button>

      <details className="cw-disclosure">
        <summary>Lohnt sich das?</summary>
        <div className="cw-prose">
          <p>
            Die Goldvariante ist selten billiger als das Paket — sie ist flexibler.
            Wer eine bestimmte Waffe, eine bessere Rüstung oder einen Zauberfokus im
            Kopf hat, kauft gezielt. Wer heute Abend spielen will, nimmt das Paket.
          </p>
          <p>
            Rüstung und Waffen kannst du nur benutzen, wenn deine Klasse darin geübt
            ist — der Blick auf den Klassenschritt lohnt vor dem Einkauf.
          </p>
        </div>
      </details>
    </div>
  );
}

export function EquipmentStep({ draft, set, resolved, validation, goTo }: StepProps) {
  const dndClass = resolved.dndClass;
  const background = resolved.background;
  const [showTotalsHelp, setShowTotalsHelp] = useState(false);

  if (!dndClass) {
    return (
      <div className="cw-empty">
        <span className="cw-empty__icon" aria-hidden="true">
          <NavIcon name="backpack" width={28} height={28} />
        </span>
        <p className="cw-empty__title">Erst die Klasse, dann der Rucksack</p>
        <p className="cw-empty__text">
          Womit du losziehst, hängt daran, was du gelernt hast: Der Barbar bekommt
          eine Großaxt, der Magier ein Zauberbuch. Wähle zuerst eine Klasse — danach
          steht hier deine Startausrüstung zur Wahl.
        </p>
        <Button onClick={() => goTo("class")}>
          Zur Klassenwahl
          <NavIcon name="arrow-right" width={16} height={16} />
        </Button>
      </div>
    );
  }

  const options = dndClass.startingEquipment;
  const goldAlternative = dndClass.startingGoldAlternative;

  return (
    <div>
      <section className="cw-section">
        <div className="cw-section__head">
          <h3 className="cw-section__title">Deine Wahl</h3>
          <span className="cw-chip" data-tone="accent">
            {dndClass.name}
          </span>
          {draft.equipmentChoice ? (
            <span className="cw-chip">gewählt</span>
          ) : (
            <span className="cw-chip">noch offen</span>
          )}
        </div>
        <p className="cw-section__note">
          Genau eine dieser Karten. Die Kennzahlen stehen auf jeder Karte an
          derselben Stelle, damit du sie nebeneinander lesen kannst — Stücke,
          Gewicht, Wert.
        </p>

        {options.length === 0 && goldAlternative === null ? (
          <div className="cw-empty">
            <span className="cw-empty__icon" aria-hidden="true">
              <NavIcon name="package-open" width={28} height={28} />
            </span>
            <p className="cw-empty__title">Für {dndClass.name} ist nichts hinterlegt</p>
            <p className="cw-empty__text">
              Der Katalog führt zu dieser Klasse weder ein Ausrüstungspaket noch eine
              Goldsumme. Das ist eine Lücke im Inhalt, kein Fehler deiner Wahl — sag
              deiner Spielleitung Bescheid und rüste am Tisch aus.
            </p>
          </div>
        ) : (
          <div className="cw-grid" data-wide="true" role="group" aria-label="Startausrüstung">
            {options.map((option) => (
              <OptionCard
                key={option.key}
                option={option}
                selected={draft.equipmentChoice === option.key}
                onSelect={() => set("equipmentChoice", option.key)}
              />
            ))}
            {goldAlternative !== null ? (
              <GoldCard
                gold={goldAlternative}
                selected={draft.equipmentChoice === GOLD_CHOICE}
                onSelect={() => set("equipmentChoice", GOLD_CHOICE)}
              />
            ) : null}
          </div>
        )}

        {validation.issues.length > 0 ? (
          <div className="cw-note" data-tone="blocked">
            <NavIcon name="triangle-alert" width={18} height={18} />
            <span className="cw-note__text">{validation.issues[0]}</span>
          </div>
        ) : null}

        <div className="cw-actions">
          <Button
            variant="ghost"
            aria-expanded={showTotalsHelp}
            onClick={() => setShowTotalsHelp((current) => !current)}
          >
            <NavIcon name="scale" width={16} height={16} />
            Woher Gewicht und Wert kommen
          </Button>
        </div>

        {showTotalsHelp ? (
          <div className="cw-note">
            <NavIcon name="info" width={18} height={18} />
            <span className="cw-note__text">
              Gewicht und Wert stammen aus dem Ausrüstungskatalog; Pakete werden über
              ihren Inhalt aufgelöst. Wo eine Zeile keine Zahl hinterlegt hat, steht
              vor dem Wert {"„mind.“"} — die Summe ist dann eine Untergrenze, keine
              Behauptung.
            </span>
          </div>
        ) : null}
      </section>

      <section className="cw-section">
        <div className="cw-section__head">
          <h3 className="cw-section__title">Vom Hintergrund — kommt immer dazu</h3>
          {background ? <span className="cw-chip">{background.name}</span> : null}
        </div>

        {background ? (
          <>
            <p className="cw-section__note">
              Diese Sachen gehören nicht zur Wahl oben. Dein Hintergrund gibt sie dir
              zusätzlich — deshalb stehen sie hier getrennt.
            </p>
            <div className="cw-slab">
              <ul className="cw-items">
                {background.equipment.map((line) => (
                  <li key={line} className="cw-item">
                    <span className="cw-item__qty" aria-hidden="true">
                      ●
                    </span>
                    <span className="cw-item__name">{line}</span>
                  </li>
                ))}
                <li className="cw-item">
                  <span className="cw-item__qty">+</span>
                  <span className="cw-item__name">
                    {background.startingGold} GM Startgold
                  </span>
                </li>
              </ul>
              {/* Die Hintergrundliste ist Klartext ohne Mengen- und Gewichtsdaten —
                  hier stünde jede Summe auf tönernen Füßen. Also nur, was stimmt. */}
              <span className="cw-tile__meta">
                <span className="cw-chip">
                  Einträge <span className="cw-chip__value">{background.equipment.length}</span>
                </span>
                <span className="cw-chip">
                  Startgold <span className="cw-chip__value">{background.startingGold} GM</span>
                </span>
              </span>
            </div>
          </>
        ) : (
          <div className="cw-note">
            <NavIcon name="scroll-text" width={18} height={18} />
            <span className="cw-note__text">
              Noch kein Hintergrund gewählt — der bringt eigene Ausrüstung mit, die zu
              allem hier dazukommt.
            </span>
          </div>
        )}

        {background ? (
          <div className="cw-actions">
            <Button variant="outline" onClick={() => goTo("background")}>
              Hintergrund ansehen
            </Button>
          </div>
        ) : (
          <div className="cw-actions">
            <Button onClick={() => goTo("background")}>
              Hintergrund wählen
              <NavIcon name="arrow-right" width={16} height={16} />
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
