import type {
  AbilityScores,
  CharacterDerivedStats,
  SkillProficiencyLevel,
} from "@uwe/database/server";
import { ResponsiveTable } from "./ResponsiveTable";

const ABILITY_LABELS: Record<keyof AbilityScores, string> = {
  strength: "Stärke",
  dexterity: "Geschick",
  constitution: "Konstitution",
  intelligence: "Intelligenz",
  wisdom: "Weisheit",
  charisma: "Charisma",
};

const PROFICIENCY_LABELS: Record<SkillProficiencyLevel, string> = {
  none: "—",
  proficient: "Geübt",
  expertise: "Expertise",
};

function formatModifier(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

export interface CharacterDerivedStatsSectionProps {
  derived: CharacterDerivedStats;
}

/**
 * Read-only display of auto-calculated 2024 values: passive scores, spell save
 * DC / attack bonus, saving throws and skill modifiers. Server-component safe.
 */
export function CharacterDerivedStatsSection({ derived }: CharacterDerivedStatsSectionProps) {
  return (
    <section className="auth-character-derived">
      <h3>Abgeleitete Werte (automatisch)</h3>
      <dl className="auth-character-sheet-summary">
        <div>
          <dt>Passive Wahrnehmung</dt>
          <dd>{derived.passivePerception}</dd>
        </div>
        <div>
          <dt>Passive Nachforschungen</dt>
          <dd>{derived.passiveInvestigation}</dd>
        </div>
        <div>
          <dt>Passives Motiv erkennen</dt>
          <dd>{derived.passiveInsight}</dd>
        </div>
        <div>
          <dt>Zauberattribut</dt>
          <dd>{derived.spellcastingAbility ? ABILITY_LABELS[derived.spellcastingAbility] : "—"}</dd>
        </div>
        <div>
          <dt>Zauber-Rettungswurf-SG</dt>
          <dd>{derived.spellSaveDc ?? "—"}</dd>
        </div>
        <div>
          <dt>Zauberangriffsbonus</dt>
          <dd>{derived.spellAttackBonus !== null ? formatModifier(derived.spellAttackBonus) : "—"}</dd>
        </div>
      </dl>

      <h4>Rettungswürfe</h4>
      <ResponsiveTable
        caption="Rettungswürfe"
        rowKey={(save) => save.ability}
        rows={derived.savingThrows}
        // `scroll` statt Karten: die Werte sind zwei Zeichen lang. Sechs
        // Rettungswürfe als sechs Karten wären mehr Weg, nicht weniger.
        mobile="scroll"
        columns={[
          {
            key: "ability",
            label: "Attribut",
            primary: true,
            render: (save) => ABILITY_LABELS[save.ability],
          },
          {
            key: "modifier",
            label: "Modifikator",
            numeric: true,
            render: (save) => formatModifier(save.modifier),
          },
          { key: "proficient", label: "Geübt", render: (save) => (save.proficient ? "Ja" : "—") },
        ]}
      />

      <h4>Fertigkeiten</h4>
      <ResponsiveTable
        caption="Fertigkeiten"
        rowKey={(skill) => skill.key}
        rows={derived.skills}
        mobile="scroll"
        columns={[
          { key: "skill", label: "Fertigkeit", primary: true, render: (skill) => skill.label },
          {
            key: "ability",
            label: "Attribut",
            render: (skill) => ABILITY_LABELS[skill.ability],
          },
          {
            key: "modifier",
            label: "Modifikator",
            numeric: true,
            render: (skill) => formatModifier(skill.modifier),
          },
          {
            key: "proficiency",
            label: "Übung",
            render: (skill) => PROFICIENCY_LABELS[skill.proficiency],
          },
        ]}
      />
    </section>
  );
}

export interface CharacterProficiencyFieldsProps {
  derived: CharacterDerivedStats;
}

/**
 * Form fields (selects) for saving-throw / skill proficiencies and the
 * spellcasting ability. Must be rendered inside a form that posts to the
 * character sheet update action. Server-component safe.
 */
export function CharacterProficiencyFields({ derived }: CharacterProficiencyFieldsProps) {
  return (
    <details className="auth-character-proficiency-editor">
      <summary>Übungen, Expertise &amp; Zauberattribut</summary>

      <label>
        Zauberattribut
        <select name="spellcastingAbility" defaultValue={derived.spellcastingAbilitySetting}>
          <option value="auto">Automatisch (aus Klassen)</option>
          <option value="none">Kein Zauberwirker</option>
          {derived.savingThrows.map((save) => (
            <option key={save.ability} value={save.ability}>
              {ABILITY_LABELS[save.ability]}
            </option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend>Rettungswurf-Übungen</legend>
        <div className="auth-character-sheet-grid">
          {derived.savingThrows.map((save) => (
            <label key={save.ability}>
              {ABILITY_LABELS[save.ability]}
              <select
                name={`save_${save.ability}`}
                defaultValue={save.proficient ? "proficient" : "none"}
              >
                <option value="none">Ungeübt</option>
                <option value="proficient">Geübt</option>
              </select>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Fertigkeiten</legend>
        <div className="auth-character-sheet-grid">
          {derived.skills.map((skill) => (
            <label key={skill.key}>
              {skill.label}
              <select name={`skill_${skill.key}`} defaultValue={skill.proficiency}>
                <option value="none">Ungeübt</option>
                <option value="proficient">Geübt</option>
                <option value="expertise">Expertise</option>
              </select>
            </label>
          ))}
        </div>
      </fieldset>
    </details>
  );
}
