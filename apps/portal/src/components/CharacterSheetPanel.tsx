import type { PortalCharacterView } from "@uwe/database/server";
import { CharacterSpellSection } from "@uwe/shared-ui";
import {
  addHomebrewSpellAction,
  addSpellAction,
  removeSpellAction,
  searchOpen5eSpellsAction,
  togglePreparedAction,
  updateCharacterSheetAction,
} from "../../app/character-sheet-actions";

interface CharacterSheetPanelProps {
  worldSlug: string;
  pageSlug: string;
  character: PortalCharacterView;
  returnPath: string;
  canEdit: boolean;
}

const ABILITY_LABELS: Record<string, string> = {
  strength: "Stärke",
  dexterity: "Geschick",
  constitution: "Konstitution",
  intelligence: "Intelligenz",
  wisdom: "Weisheit",
  charisma: "Charisma",
};

function formatModifier(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

export function CharacterSheetPanel({
  worldSlug,
  pageSlug,
  character,
  returnPath,
  canEdit,
}: CharacterSheetPanelProps) {
  const { sheet } = character;

  return (
    <section className="auth-block auth-character-sheet">
      <h2>Charakterbogen</h2>
      <p className="auth-muted">
        Strukturierte Werte (D&amp;D 2024) — Modifikatoren und Übungsbonus werden automatisch berechnet.
      </p>

      <dl className="auth-character-sheet-summary">
        <div>
          <dt>Stufe</dt>
          <dd>{sheet.level}</dd>
        </div>
        <div>
          <dt>Übungsbonus</dt>
          <dd>{formatModifier(sheet.proficiencyBonus)}</dd>
        </div>
        <div>
          <dt>Rüstungsklasse</dt>
          <dd>{sheet.armorClass ?? "—"}</dd>
        </div>
        <div>
          <dt>Initiative</dt>
          <dd>{formatModifier(sheet.initiative)}</dd>
        </div>
      </dl>

      <table className="auth-character-abilities">
        <thead>
          <tr>
            <th>Attribut</th>
            <th>Wert</th>
            <th>Modifikator</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(ABILITY_LABELS).map(([key, label]) => {
            const abilityKey = key as keyof typeof sheet.abilities;
            return (
              <tr key={key}>
                <td>{label}</td>
                <td>{sheet.abilities[abilityKey]}</td>
                <td>{formatModifier(sheet.modifiers[abilityKey])}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {canEdit ? (
        <form action={updateCharacterSheetAction} className="auth-note-form auth-character-sheet-form">
          <input type="hidden" name="worldSlug" value={worldSlug} />
          <input type="hidden" name="characterId" value={character.id} />
          <input type="hidden" name="pageSlug" value={pageSlug} />
          <input type="hidden" name="returnPath" value={returnPath} />

          <h3>Werte bearbeiten</h3>

          <label>
            Stufe
            <input
              name="level"
              type="number"
              min={1}
              max={30}
              defaultValue={sheet.level}
              required
            />
          </label>

          <div className="auth-character-sheet-grid">
            {Object.entries(ABILITY_LABELS).map(([key, label]) => {
              const abilityKey = key as keyof typeof sheet.abilities;
              return (
                <label key={key}>
                  {label}
                  <input
                    name={key}
                    type="number"
                    min={1}
                    max={30}
                    defaultValue={sheet.abilities[abilityKey]}
                    required
                  />
                </label>
              );
            })}
          </div>

          <label>
            Rüstungsklasse (RK)
            <input
              name="armorClass"
              type="number"
              min={1}
              max={99}
              defaultValue={sheet.combat.armorClass ?? ""}
              placeholder="z. B. 16"
            />
          </label>

          <label>
            Initiativ-Bonus (zusätzlich zu GES)
            <input
              name="initiativeBonus"
              type="number"
              min={-10}
              max={20}
              defaultValue={sheet.combat.initiativeBonus ?? 0}
            />
          </label>

          <button type="submit" className="auth-btn auth-btn-small">
            Charakterbogen speichern
          </button>
        </form>
      ) : (
        <p className="auth-muted">Nur der Charaktereigentümer kann die Werte bearbeiten.</p>
      )}

      <CharacterSpellSection
        spells={character.spells}
        spellSlots={character.spellSlots}
        canEdit={canEdit}
        hiddenFields={{
          worldSlug,
          characterId: character.id,
          pageSlug,
          returnPath,
        }}
        addSpellAction={addSpellAction}
        removeSpellAction={removeSpellAction}
        togglePreparedAction={togglePreparedAction}
        addHomebrewSpellAction={addHomebrewSpellAction}
        searchSpellsAction={searchOpen5eSpellsAction}
      />
    </section>
  );
}
