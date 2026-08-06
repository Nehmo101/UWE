"use client";

/**
 * Die rechte Spalte: was aus den Entscheidungen bisher geworden ist.
 *
 * Sie ist der Grund, warum der Ersteller sich nicht wie ein Formular
 * anfühlt. Jede Wahl im linken Bereich verändert hier sofort eine Zahl —
 * Trefferpunkte beim Klassenwechsel, Attribute beim Hintergrund,
 * Wahrnehmung bei den Fertigkeiten. Ohne diese Rückmeldung ist eine
 * Klassenwahl eine Behauptung; mit ihr ist sie eine Entscheidung.
 */

import {
  ABILITIES,
  ABILITY_SHORT,
  formatModifier,
  type Background,
  type CharacterDraft,
  type DerivedPreview,
  type DndClass,
  type Species,
  type SpeciesLineage,
  type Subclass,
} from "@uwe/character-creator";

export interface CharacterRailProps {
  draft: CharacterDraft;
  preview: DerivedPreview;
  species: Species | null;
  lineage: SpeciesLineage | null;
  dndClass: DndClass | null;
  subclass: Subclass | null;
  background: Background | null;
}

function Vital({
  label,
  value,
  title,
  signed = false,
}: {
  label: string;
  value: number | null;
  title: string;
  /** Initiative ist ein Modifikator und wird mit Vorzeichen gelesen, nicht als Menge. */
  signed?: boolean;
}) {
  const empty = value === null;
  return (
    <div className="cw-vital" title={title}>
      <span className="cw-vital__value" data-empty={empty}>
        {empty ? "—" : signed ? formatModifier(value) : value}
      </span>
      <span className="cw-vital__label">{label}</span>
    </div>
  );
}

export function CharacterRail({
  draft,
  preview,
  species,
  lineage,
  dndClass,
  subclass,
  background,
}: CharacterRailProps) {
  const hasName = draft.name.trim().length > 0;

  // Die Unterzeile liest sich wie eine Vorstellung: „Waldelf · Waldläufer".
  // Leere Teile fallen weg, statt „— · —" zu erzeugen.
  const descriptors = [
    lineage?.name ?? species?.name,
    dndClass?.name,
    background?.name,
  ].filter((part): part is string => Boolean(part));

  const boosted = new Set(
    Object.entries(draft.abilities?.backgroundBonus ?? {})
      .filter(([, value]) => (value ?? 0) > 0)
      .map(([ability]) => ability),
  );

  const abilitiesChosen = draft.abilities !== null;

  return (
    <aside className="cw-rail" aria-label="Dein Charakter">
      <div>
        <p className="cw-rail__name" data-placeholder={!hasName}>
          {hasName ? draft.name : "Namenlos"}
        </p>
        <p className="cw-rail__subtitle">
          {descriptors.length > 0 ? descriptors.join(" · ") : "Stufe 1 · noch nichts entschieden"}
        </p>
      </div>

      <div className="cw-vitals">
        <Vital
          label="TP"
          value={preview.hitPoints}
          title="Trefferpunkte auf Stufe 1: Trefferwürfel + Konstitutionsmodifikator"
        />
        <Vital label="RK" value={preview.armorClass} title="Rüstungsklasse ohne Rüstung: 10 + Geschicklichkeit" />
        <Vital
          label="Init"
          value={preview.initiative}
          title="Initiative: Geschicklichkeitsmodifikator"
          signed
        />
      </div>

      <div>
        <p className="cw-rail__section-title">Attribute</p>
        <div className="cw-abilities">
          {ABILITIES.map((ability) => (
            <div key={ability} className="cw-ability" data-boosted={boosted.has(ability)}>
              <span className="cw-ability__short">{ABILITY_SHORT[ability]}</span>
              <span className="cw-ability__mod">
                {abilitiesChosen ? formatModifier(preview.modifiers[ability]) : "—"}
              </span>
              <span className="cw-ability__score">
                {abilitiesChosen ? preview.scores[ability] : " "}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="cw-rail__section-title">Geübt in</p>
        {preview.skillProficiencies.length === 0 ? (
          <p className="cw-rail__empty">Noch keine Fertigkeiten.</p>
        ) : (
          <div className="cw-tile__meta" style={{ borderTop: "none", paddingTop: 0 }}>
            {preview.skillProficiencies.map((skill) => (
              <span key={skill} className="cw-chip" data-tone="accent">
                {SKILL_LABELS[skill] ?? skill}
              </span>
            ))}
          </div>
        )}
      </div>

      {preview.spellcastingAbility ? (
        <div>
          <p className="cw-rail__section-title">Zauberei</p>
          <div className="cw-tile__meta" style={{ borderTop: "none", paddingTop: 0 }}>
            <span className="cw-chip">
              SG <span className="cw-chip__value">{preview.spellSaveDc ?? "—"}</span>
            </span>
            <span className="cw-chip">
              Angriff{" "}
              <span className="cw-chip__value">
                {preview.spellAttackBonus === null
                  ? "—"
                  : formatModifier(preview.spellAttackBonus)}
              </span>
            </span>
          </div>
        </div>
      ) : null}

      <div>
        <p className="cw-rail__section-title">Weiteres</p>
        <div className="cw-tile__meta" style={{ borderTop: "none", paddingTop: 0 }}>
          <span className="cw-chip">
            Übungsbonus <span className="cw-chip__value">+{preview.proficiencyBonus}</span>
          </span>
          {preview.speed !== null ? (
            <span className="cw-chip">
              Tempo <span className="cw-chip__value">{preview.speed}</span> Fuß
            </span>
          ) : null}
          {preview.darkvision ? (
            <span className="cw-chip">
              Dunkelsicht <span className="cw-chip__value">{preview.darkvision}</span> Fuß
            </span>
          ) : null}
          {subclass ? <span className="cw-chip">{subclass.name}</span> : null}
        </div>
      </div>
    </aside>
  );
}

/**
 * Deutsche Fertigkeitsnamen.
 *
 * Dieselben Beschriftungen wie im Charakterbogen
 * (`SKILL_DEFINITIONS` in `@uwe/database`). Sie stehen hier noch einmal,
 * weil das Portal-Bündel den Server-Barrel nicht laden darf — `skill-parity`
 * im Erstellerpaket hält beide Listen deckungsgleich.
 */
const SKILL_LABELS: Record<string, string> = {
  acrobatics: "Akrobatik",
  animal_handling: "Mit Tieren umgehen",
  arcana: "Arkane Kunde",
  athletics: "Athletik",
  deception: "Täuschen",
  history: "Geschichtskunde",
  insight: "Motiv erkennen",
  intimidation: "Einschüchtern",
  investigation: "Nachforschungen",
  medicine: "Heilkunde",
  nature: "Naturkunde",
  perception: "Wahrnehmung",
  performance: "Auftreten",
  persuasion: "Überzeugen",
  religion: "Religionskunde",
  sleight_of_hand: "Fingerfertigkeit",
  stealth: "Heimlichkeit",
  survival: "Überlebenskunst",
};

export { SKILL_LABELS };
