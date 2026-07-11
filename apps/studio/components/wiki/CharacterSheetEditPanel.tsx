import Link from "next/link";
import {
  CharacterDerivedStatsSection,
  CharacterLevelUpPanel,
  CharacterProficiencyFields,
  CharacterSpellSection,
  CollapsibleSection,
} from "@uwe/shared-ui";
import {
  buildLevelUpSuggestions,
  createAuthService,
  createCharacterService,
  createPartyTreasuryService,
  createPrismaClient,
  getAppRepository,
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
  createStudioCharacterSheetAction,
  importSpellsByLevelAction,
  removeSpellAction,
  togglePreparedAction,
  updateStudioCharacterSheetAction,
} from "@/app/worlds/[worldSlug]/character-sheet-actions";
import { Button, buttonVariants, Input, Label, Textarea } from "@/src/components/ui";

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
  const repo = getAppRepository();
  const auth = createAuthService(db);
  const characters = createCharacterService(db);
  const page = await repo.getPageById(pageId);
  const characterRecord = await characters.getByPageId(pageId);
  const worldPlayers = characterRecord ? [] : await auth.listWorldPlayers(worldSlug);
  const inventoryItems = characterRecord
    ? await createPartyTreasuryService(db).listItemsForCharacter(characterRecord.id)
    : [];
  await db.$disconnect();

  if (!page) {
    return null;
  }

  if (!characterRecord) {
    return (
      <CollapsibleSection title="Charakterbogen">
        <p className="text-sm text-muted-foreground">
          Für diese Spielercharakter-Seite ist noch kein strukturierter Charakterbogen verknüpft.
        </p>
        <form action={createStudioCharacterSheetAction} className="uwe-v2-form">
          <input type="hidden" name="worldSlug" value={worldSlug} />
          <input type="hidden" name="pageId" value={pageId} />
          <input type="hidden" name="pageSlug" value={pageSlug} />
          <input type="hidden" name="category" value={category} />

          <label>
            Anzeigename
            <input name="displayName" defaultValue={page.title} required />
          </label>

          <label>
            Besitzer (Spieler)
            <select name="ownerUserId" required defaultValue={worldPlayers[0]?.userId ?? ""}>
              {worldPlayers.length === 0 ? (
                <option value="">Keine Spieler in dieser Welt</option>
              ) : (
                worldPlayers.map((membership) => (
                  <option key={membership.userId} value={membership.userId}>
                    {membership.user.displayName}
                    {membership.characterName ? ` (${membership.characterName})` : ""}
                  </option>
                ))
              )}
            </select>
          </label>

          <label>
            Startstufe
            <input name="level" type="number" min={1} max={30} defaultValue={1} required />
          </label>

          <button
            type="submit"
            className="uwe-v2-btn uwe-v2-btn-primary"
            disabled={worldPlayers.length === 0}
          >
            Charakterbogen erstellen
          </button>
        </form>
        {worldPlayers.length === 0 ? (
          <p className="uwe-hint">
            Lege zuerst einen Spieler mit Welt-Mitgliedschaft an, bevor du einen Charakterbogen
            verknüpfst.
          </p>
        ) : null}
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
      <p className="text-sm text-muted-foreground">
        Strukturierte D&amp;D-2024-Werte — Modifikatoren, Übungsbonus und Initiative werden
        automatisch berechnet.
      </p>
      <p>
        <Link href={printUrl} className={buttonVariants({ size: "sm" })} target="_blank" rel="noreferrer">
          Druck / Export
        </Link>
      </p>

      <dl className="grid grid-cols-[minmax(6rem,10rem)_1fr] gap-x-4 gap-y-1 text-sm [&>dt]:text-muted-foreground [&>dd]:m-0">
        <dt>Übungsbonus</dt>
        <dd>{formatModifier(sheet.proficiencyBonus)}</dd>
        <dt>Initiative (berechnet)</dt>
        <dd>{formatModifier(sheet.initiative)}</dd>
      </dl>

      <CharacterDerivedStatsSection derived={sheet.derived} />

      <form action={updateStudioCharacterSheetAction} className="flex flex-col gap-4">
        <input type="hidden" name="worldSlug" value={worldSlug} />
        <input type="hidden" name="pageId" value={pageId} />
        <input type="hidden" name="pageSlug" value={pageSlug} />
        <input type="hidden" name="category" value={category} />
        <input type="hidden" name="characterId" value={character.id} />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="character-sheet-display-name">Anzeigename</Label>
          <Input
            id="character-sheet-display-name"
            name="displayName"
            defaultValue={character.displayName}
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="character-sheet-level">Stufe</Label>
          <Input
            id="character-sheet-level"
            name="level"
            type="number"
            min={1}
            max={30}
            defaultValue={sheet.level}
            required
          />
        </div>

        {Object.entries(ABILITY_LABELS).map(([key, label]) => {
          const abilityKey = key as keyof typeof sheet.abilities;
          return (
            <div key={key} className="flex flex-col gap-1.5">
              <Label htmlFor={`character-sheet-ability-${key}`}>{label}</Label>
              <Input
                id={`character-sheet-ability-${key}`}
                name={key}
                type="number"
                min={1}
                max={30}
                defaultValue={sheet.abilities[abilityKey]}
                required
              />
              <span className="text-sm text-muted-foreground">
                Mod: {formatModifier(sheet.modifiers[abilityKey])}
              </span>
            </div>
          );
        })}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="character-sheet-armor-class">Rüstungsklasse (RK)</Label>
          <Input
            id="character-sheet-armor-class"
            name="armorClass"
            type="number"
            min={1}
            max={99}
            defaultValue={sheet.combat.armorClass ?? ""}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="character-sheet-initiative-bonus">Initiativ-Bonus (zusätzlich zu GES)</Label>
          <Input
            id="character-sheet-initiative-bonus"
            name="initiativeBonus"
            type="number"
            min={-10}
            max={20}
            defaultValue={sheet.combat.initiativeBonus ?? 0}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="character-sheet-notes">Notizen</Label>
          <Textarea id="character-sheet-notes" name="notes" rows={3} defaultValue={character.notes} />
        </div>

        <CharacterProficiencyFields derived={sheet.derived} />

        <Button type="submit">Charakterbogen speichern</Button>
      </form>

      <section className="mt-4 flex flex-col gap-2">
        <h4 className="font-medium">Inventar ({inventoryItems.length})</h4>
        {inventoryItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Gegenstände im Inventar.</p>
        ) : (
          <ul className="m-0 list-disc pl-5 text-sm">
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
        <p className="text-sm text-muted-foreground">
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
        importSpellsByLevelAction={importSpellsByLevelAction}
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
