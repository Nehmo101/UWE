import {
  CharacterDerivedStatsSection,
  CharacterLevelUpPanel,
  CharacterProficiencyFields,
  CharacterSpellSection,
  CollapsibleSection,
} from "@uwe/shared-ui";
import {
  buildLevelUpSuggestions,
  createCharacterService,
  createPartyTreasuryService,
  createPrismaClient,
  getInventoryItemDmNotes,
  isInventoryItemDmOnly,
  type PortalCharacterView,
  toPortalCharacterView,
} from "@uwe/database/server";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import {
  addHomebrewSpellAction,
  addSpellAction,
  applyStudioLevelUpAction,
  removeSpellAction,
  togglePreparedAction,
  updateStudioCharacterSheetAction,
} from "@/app/worlds/[worldSlug]/character-sheet-actions";

interface Props {
  worldSlug: string;
  pageId: string;
  pageSlug: string;
  category: string;
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

export async function CharacterSheetEditPanel({ worldSlug, pageId, pageSlug, category }: Props) {
  const db = createPrismaClient();
  const characters = createCharacterService(db);
  const characterRecord = await characters.getByPageId(pageId);
  const inventoryItems = characterRecord
    ? await createPartyTreasuryService(db).listItemsForCharacter(characterRecord.id)
    : [];
  await db.$disconnect();

  if (!characterRecord) {
    return (
      <CollapsibleSection title="Charakterbogen">
        <p className="uwe-hint">
          Für diese Seite ist noch kein strukturierter Charakterbogen verknüpft. Lege einen
          Character-Datensatz mit pageId an (Wave C0b).
        </p>
      </CollapsibleSection>
    );
  }

  const character: PortalCharacterView = toPortalCharacterView(characterRecord);
  const { sheet } = character;
  const levelUpSuggestions = buildLevelUpSuggestions({
    level: characterRecord.level,
    classes: characterRecord.classes,
    abilities: characterRecord.abilities,
    combat: characterRecord.combat,
  });
  const printUrl = `/worlds/${worldSlug}/characters/print?characterId=${encodeURIComponent(character.id)}`;

  return (
    <CollapsibleSection title="Charakterbogen" defaultOpen>
      <p className="uwe-hint">
        Strukturierte D&amp;D-2024-Werte — Modifikatoren, Übungsbonus und Initiative werden
        automatisch berechnet.
      </p>
      <p>
        <a href={printUrl} className="uwe-v2-btn uwe-v2-btn-small" target="_blank" rel="noreferrer">
          Druck / Export
        </a>
      </p>

      <dl className="auth-character-sheet-summary">
        <div>
          <dt>Übungsbonus</dt>
          <dd>{formatModifier(sheet.proficiencyBonus)}</dd>
        </div>
        <div>
          <dt>Initiative (berechnet)</dt>
          <dd>{formatModifier(sheet.initiative)}</dd>
        </div>
      </dl>

      <CharacterDerivedStatsSection derived={sheet.derived} />

      <form action={updateStudioCharacterSheetAction} className="uwe-v2-form">
        <input type="hidden" name="worldSlug" value={worldSlug} />
        <input type="hidden" name="pageId" value={pageId} />
        <input type="hidden" name="pageSlug" value={pageSlug} />
        <input type="hidden" name="category" value={category} />
        <input type="hidden" name="characterId" value={character.id} />

        <label>
          Anzeigename
          <input name="displayName" defaultValue={character.displayName} required />
        </label>

        <label>
          Stufe
          <input name="level" type="number" min={1} max={30} defaultValue={sheet.level} required />
        </label>

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
              <span className="uwe-hint">Mod: {formatModifier(sheet.modifiers[abilityKey])}</span>
            </label>
          );
        })}

        <label>
          Rüstungsklasse (RK)
          <input
            name="armorClass"
            type="number"
            min={1}
            max={99}
            defaultValue={sheet.combat.armorClass ?? ""}
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

        <label>
          Notizen
          <textarea name="notes" rows={3} defaultValue={character.notes} />
        </label>

        <CharacterProficiencyFields derived={sheet.derived} />

        <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
          Charakterbogen speichern
        </button>
      </form>

      <section style={{ marginTop: "1rem" }}>
        <h4 style={{ marginBottom: "0.35rem" }}>Inventar ({inventoryItems.length})</h4>
        {inventoryItems.length === 0 ? (
          <p className="uwe-hint">Keine Gegenstände im Inventar.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
            {inventoryItems.map((item) => {
              const dmNotes = getInventoryItemDmNotes(item);
              return (
                <li key={item.id}>
                  {item.name}
                  {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                  {isInventoryItemDmOnly(item) ? " (Nur DM)" : ""}
                  {dmNotes ? ` — DM: ${dmNotes}` : ""}
                </li>
              );
            })}
          </ul>
        )}
        <p className="uwe-hint">
          Items zuweisen/zurücklegen:{" "}
          <a href={`/worlds/${worldSlug}/treasury`}>Gruppenschatz</a>
        </p>
      </section>

      <CharacterSpellSection
        spells={character.spells}
        spellSlots={character.spellSlots}
        canEdit
        hiddenFields={{
          worldSlug,
          pageId,
          pageSlug,
          category,
          characterId: character.id,
        }}
        addSpellAction={addSpellAction}
        removeSpellAction={removeSpellAction}
        togglePreparedAction={togglePreparedAction}
        addHomebrewSpellAction={addHomebrewSpellAction}
        searchSpellsUrl={studioApiUrl("/api/dnd/spells/search")}
      />

      {levelUpSuggestions && (
        <CharacterLevelUpPanel
          suggestions={levelUpSuggestions}
          canEdit
          hiddenFields={{
            worldSlug,
            pageId,
            pageSlug,
            category,
            characterId: character.id,
          }}
          applyLevelUpAction={applyStudioLevelUpAction}
        />
      )}
    </CollapsibleSection>
  );
}
