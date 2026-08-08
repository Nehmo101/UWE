"use client";

/**
 * Schritt „Fertigkeiten“ — worin der Charakter geübt ist.
 *
 * Der Schritt ist kleiner als der Attributsschritt und hat trotzdem drei
 * Fallen, die ihn regelmäßig unbrauchbar machen:
 *
 *  1. **Der Hintergrund hat schon zugeschlagen.** Zwei der Fertigkeiten sind
 *     vergeben, bevor der Spieler hier ankommt. Sie fehlen zu lassen, wäre
 *     eine Lüge; sie wählbar zu machen, wäre ein Regelfehler. Also stehen sie
 *     in derselben Liste — festgesetzt, mit dem Grund daneben.
 *  2. **Zu viel gewählt darf nicht stumm scheitern.** Ein Klick, der nichts
 *     tut, liest sich als kaputte Oberfläche. Deshalb sagt jeder blockierte
 *     Klick, was stattdessen zu tun ist.
 *  3. **Eine Fertigkeit ohne Zahl ist eine Vokabel.** Neben jedem Namen steht
 *     das Attribut und der Wurfbonus, den die Übung tatsächlich ergibt —
 *     sonst wählt man nach Klang statt nach Wirkung.
 */

import { useState } from "react";
import {
  ABILITIES,
  ABILITY_LABELS,
  ABILITY_SHORT,
  SKILLS,
  formatModifier,
  type AbilityKey,
  type SkillKey,
} from "@uwe/character-creator";

import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { NavIcon } from "@/src/components/ui/icon";
import { SKILL_LABELS } from "../CharacterRail";
import type { StepProps } from "../types";

/**
 * Welches Attribut eine Fertigkeit trägt.
 *
 * Steht hier und nicht im Katalogpaket, aus demselben Grund wie
 * `SKILL_LABELS` in `CharacterRail`: Die Wahrheit für den Bogen liegt in
 * `SKILL_DEFINITIONS` (`@uwe/database`), und der Server-Barrel darf nicht ins
 * Portal-Bündel. `skill-parity.test.ts` hält die Schlüsselmengen deckungsgleich.
 */
const SKILL_ABILITY: Record<SkillKey, AbilityKey> = {
  acrobatics: "dexterity",
  animal_handling: "wisdom",
  arcana: "intelligence",
  athletics: "strength",
  deception: "charisma",
  history: "intelligence",
  insight: "wisdom",
  intimidation: "charisma",
  investigation: "intelligence",
  medicine: "wisdom",
  nature: "intelligence",
  perception: "wisdom",
  performance: "charisma",
  persuasion: "charisma",
  religion: "intelligence",
  sleight_of_hand: "dexterity",
  stealth: "dexterity",
  survival: "wisdom",
};

/** Ein Halbsatz pro Fertigkeit — was man damit am Tisch wirklich tut. */
const SKILL_HINTS: Record<SkillKey, string> = {
  acrobatics: "Balancieren, sich aus einem Griff winden, im Sturz landen.",
  animal_handling: "Reittiere beruhigen, Absichten von Tieren lesen.",
  arcana: "Zauber erkennen, magische Zeichen deuten, Anderswelten kennen.",
  athletics: "Klettern, schwimmen, springen, jemanden festhalten.",
  deception: "Glaubhaft lügen, sich verstellen, ein falsches Siegel verkaufen.",
  history: "Herrscher, Kriege, alte Ruinen und wem sie einmal gehörten.",
  insight: "Merken, wann jemand die Wahrheit dehnt.",
  intimidation: "Mit Drohung, Blick oder Ruf etwas erzwingen.",
  investigation: "Aus Spuren schließen, Verstecke finden, Fälschungen erkennen.",
  medicine: "Sterbende stabilisieren, Krankheiten und Gifte erkennen.",
  nature: "Gelände, Pflanzen, Wetter und was in der Wildnis normal ist.",
  perception: "Sehen, hören, riechen — der wichtigste Wurf im Spiel.",
  performance: "Ein Publikum halten: Musik, Spiel, Rede.",
  persuasion: "Jemanden gutwillig überzeugen statt ihn zu zwingen.",
  religion: "Götter, Riten, Untote und heilige Orte.",
  sleight_of_hand: "Taschendiebstahl, Kartentricks, etwas unbemerkt verstecken.",
  stealth: "Ungesehen bleiben: schleichen, sich drücken, im Schatten warten.",
  survival: "Spuren lesen, Wege finden, Lager schlagen, jagen.",
};

/** Suchtext auf Fertigkeitsnamen und Halbsatz anwenden. */
function matches(skill: SkillKey, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    (SKILL_LABELS[skill] ?? skill).toLowerCase().includes(needle) ||
    SKILL_HINTS[skill].toLowerCase().includes(needle)
  );
}

export function SkillsStep({ draft, set, resolved, preview, goTo }: StepProps) {
  const [query, setQuery] = useState("");
  const [abilityFilter, setAbilityFilter] = useState<AbilityKey | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const dndClass = resolved.dndClass;
  const background = resolved.background;

  if (!dndClass) {
    return (
      <div className="grid gap-3">
        <p className="cw-prose">
          Wie viele Fertigkeiten du wählen darfst und aus welcher Liste, bestimmt deine Klasse.
          Solange keine gewählt ist, gibt es hier nichts zu entscheiden.
        </p>
        <div>
          <Button variant="outline" onClick={() => goTo("class")}>
            <NavIcon name="swords" width={16} height={16} />
            Klasse wählen
          </Button>
        </div>
      </div>
    );
  }

  const fromBackground = background?.skills ?? [];
  // Leere Liste heißt im Katalog „alle achtzehn“ — nicht „keine“.
  const classChoices: readonly SkillKey[] =
    dndClass.skills.from.length > 0 ? dndClass.skills.from : SKILLS;
  const want = dndClass.skills.choose;
  const chosen = draft.chosenSkills;
  const remaining = want - chosen.length;

  // Eine Wahl kann durch einen späteren Klassen- oder Hintergrundwechsel
  // ungültig werden. Stumm wegrechnen wäre falsch — der Spieler soll sehen,
  // was passiert ist, und es mit einem Klick geradeziehen.
  const stale = chosen.filter(
    (skill) => !classChoices.includes(skill) || fromBackground.includes(skill),
  );

  const abilitiesReady = draft.abilities !== null;

  function bonusFor(skill: SkillKey, proficient: boolean): string {
    if (!abilitiesReady) return "—";
    const value = preview.modifiers[SKILL_ABILITY[skill]] + (proficient ? preview.proficiencyBonus : 0);
    return formatModifier(value);
  }

  function toggle(skill: SkillKey) {
    if (fromBackground.includes(skill)) {
      setNotice(
        `${SKILL_LABELS[skill] ?? skill} bringt dein Hintergrund ${background?.name ?? ""} schon mit — ` +
          "doppelte Übung gibt es nicht. Nimm dafür eine andere Fertigkeit.",
      );
      return;
    }
    if (chosen.includes(skill)) {
      set(
        "chosenSkills",
        chosen.filter((entry) => entry !== skill),
      );
      setNotice(null);
      return;
    }
    if (chosen.length >= want) {
      setNotice(
        `Du hast bereits ${chosen.length} von ${want} Fertigkeiten gewählt. ` +
          `Nimm zuerst eine ab — dann ist ${SKILL_LABELS[skill] ?? skill} frei.`,
      );
      return;
    }
    set("chosenSkills", [...chosen, skill]);
    setNotice(null);
  }

  function cleanUp() {
    set(
      "chosenSkills",
      chosen.filter((skill) => !stale.includes(skill)),
    );
    setNotice(null);
  }

  // Angezeigt wird alles, worin dieser Charakter geübt sein kann: die Auswahl
  // der Klasse plus das, was der Hintergrund mitbringt. Alphabetisch, damit
  // man eine bestimmte Fertigkeit findet, statt sie zu suchen.
  const visible = [...new Set<SkillKey>([...fromBackground, ...classChoices])]
    .filter((skill) => matches(skill, query))
    .filter((skill) => abilityFilter === null || SKILL_ABILITY[skill] === abilityFilter)
    .sort((a, b) => (SKILL_LABELS[a] ?? a).localeCompare(SKILL_LABELS[b] ?? b, "de"));

  const usedAbilities = ABILITIES.filter((ability) =>
    [...fromBackground, ...classChoices].some((skill) => SKILL_ABILITY[skill] === ability),
  );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="cw-chip" data-tone="accent">
          {dndClass.name}
          <span className="cw-chip__value">{want}</span> zur Wahl
        </span>
        <span className="cw-chip" aria-live="polite">
          {remaining > 0
            ? `noch ${remaining} zu wählen`
            : remaining === 0
              ? "vollständig"
              : `${-remaining} zu viel`}
        </span>
        {fromBackground.length > 0 ? (
          <span className="cw-chip">
            <NavIcon name="lock" width={12} height={12} />
            {fromBackground.length} vom Hintergrund
          </span>
        ) : null}
      </div>

      {fromBackground.length > 0 ? (
        <p className="cw-prose">
          Fest gesetzt durch <strong>{background?.name}</strong>:{" "}
          {fromBackground.map((skill) => SKILL_LABELS[skill] ?? skill).join(" und ")}. Diese Übung
          hast du schon — sie zählt nicht gegen deine {want} Wahlen und lässt sich hier nicht
          abwählen.
        </p>
      ) : null}

      {!abilitiesReady ? (
        <p className="cw-footer__hint">
          Die Boni stehen erst, wenn die Attribute verteilt sind.{" "}
          <button type="button" className="cw-filter" onClick={() => goTo("abilities")}>
            Zu den Attributen
          </button>
        </p>
      ) : null}

      {stale.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="cw-footer__hint" data-tone="blocked">
            {stale.map((skill) => SKILL_LABELS[skill] ?? skill).join(", ")} passt nicht mehr zu
            dieser Klasse oder kommt inzwischen aus dem Hintergrund.
          </span>
          <Button variant="outline" onClick={cleanUp}>
            <NavIcon name="eraser" width={16} height={16} />
            Aufräumen
          </Button>
        </div>
      ) : null}

      <div className="cw-search">
        <label className="uwe-field__label" htmlFor="cw-skill-search">
          Suchen
        </label>
        <Input
          id="cw-skill-search"
          className="w-48"
          type="search"
          value={query}
          placeholder="z. B. Heimlichkeit"
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="cw-filters" role="group" aria-label="Nach Attribut filtern">
          <button
            type="button"
            className="cw-filter"
            aria-pressed={abilityFilter === null}
            onClick={() => setAbilityFilter(null)}
          >
            Alle
          </button>
          {usedAbilities.map((ability) => (
            <button
              key={ability}
              type="button"
              className="cw-filter"
              aria-pressed={abilityFilter === ability}
              onClick={() => setAbilityFilter(abilityFilter === ability ? null : ability)}
              title={ABILITY_LABELS[ability]}
            >
              {ABILITY_SHORT[ability]}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="cw-prose">
          Keine Fertigkeit passt zu dieser Suche. Lösche den Suchtext oder stelle den
          Attributsfilter zurück auf „Alle“.
        </p>
      ) : (
        <div className="cw-grid" role="group" aria-label={`Fertigkeiten des ${dndClass.name}`}>
          {visible.map((skill) => {
            const locked = fromBackground.includes(skill);
            const selected = locked || chosen.includes(skill);
            const ability = SKILL_ABILITY[skill];
            return (
              <button
                key={skill}
                type="button"
                className="cw-tile"
                aria-pressed={selected}
                aria-disabled={locked || undefined}
                onClick={() => toggle(skill)}
              >
                <span className="cw-tile__check" aria-hidden="true">
                  <NavIcon name={locked ? "lock" : "check"} width={16} height={16} />
                </span>
                <span className="cw-tile__name">{SKILL_LABELS[skill] ?? skill}</span>
                <span className="cw-tile__hook">{SKILL_HINTS[skill]}</span>
                <span className="cw-tile__meta">
                  <span className="cw-chip" title={ABILITY_LABELS[ability]}>
                    {ABILITY_SHORT[ability]}
                  </span>
                  <span
                    className="cw-chip"
                    data-tone={selected ? "accent" : undefined}
                    title={
                      selected
                        ? `Geübt: Modifikator plus Übungsbonus ${formatModifier(preview.proficiencyBonus)}`
                        : "Ungeübt: nur der Attributsmodifikator"
                    }
                  >
                    Wurf <span className="cw-chip__value">{bonusFor(skill, selected)}</span>
                  </span>
                  {locked ? <span className="cw-chip">vom Hintergrund</span> : null}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <p className="cw-footer__hint" data-tone={notice ? "blocked" : undefined} role="status">
        {notice ??
          (remaining > 0
            ? `Noch ${remaining} von ${want} zu wählen.`
            : remaining === 0
              ? "Alle Fertigkeiten gewählt."
              : `Eine Wahl zu viel — nimm ${-remaining} wieder ab.`)}
      </p>

      <details className="cw-disclosure">
        <summary>Woher der Wurfbonus kommt</summary>
        <div className="cw-prose">
          <p>
            Ein Fertigkeitswurf ist immer W20 plus der Modifikator des zugehörigen Attributs. Wer
            in der Fertigkeit <em>geübt</em> ist, addiert zusätzlich den Übungsbonus — auf Stufe 1
            sind das {formatModifier(preview.proficiencyBonus)}. Mehr als einmal Übung gibt es
            nicht: Was der Hintergrund schon mitbringt, kann die Klasse nicht verdoppeln.
          </p>
          <p>
            Deshalb lohnt der Blick auf die Attribute, bevor man hier wählt. Heimlichkeit mit
            Dexterity −1 ist auch mit Übung kein Werkzeug, auf das man einen Plan baut.
          </p>
        </div>
      </details>
    </div>
  );
}
