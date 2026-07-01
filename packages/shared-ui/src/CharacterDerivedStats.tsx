import type {
  AbilityScores,
  CharacterDerivedStats,
  SkillProficiencyLevel,
} from "@uwe/database/server";

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
      <table className="auth-character-abilities">
        <thead>
          <tr>
            <th>Attribut</th>
            <th>Modifikator</th>
            <th>Geübt</th>
          </tr>
        </thead>
        <tbody>
          {derived.savingThrows.map((save) => (
            <tr key={save.ability}>
              <td>{ABILITY_LABELS[save.ability]}</td>
              <td>{formatModifier(save.modifier)}</td>
              <td>{save.proficient ? "Ja" : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4>Fertigkeiten</h4>
      <table className="auth-character-abilities">
        <thead>
          <tr>
            <th>Fertigkeit</th>
            <th>Attribut</th>
            <th>Modifikator</th>
            <th>Übung</th>
          </tr>
        </thead>
        <tbody>
          {derived.skills.map((skill) => (
            <tr key={skill.key}>
              <td>{skill.label}</td>
              <td>{ABILITY_LABELS[skill.ability]}</td>
              <td>{formatModifier(skill.modifier)}</td>
              <td>{PROFICIENCY_LABELS[skill.proficiency]}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
