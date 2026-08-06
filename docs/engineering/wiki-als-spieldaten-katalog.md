# Wiki als Spieldaten-Katalog

**Ziel:** Eine Wiki-Seite kann sagen, was sie regeltechnisch *ist* — eine Spezies, ein
Hintergrund, ein Zauber, eine Waffe — und einen kleinen strukturierten Abschnitt mit den
Werten tragen, die der Charakter-Ersteller im Portal braucht. Gepflegt im Studio, vorfüllbar
über den Import, sichtbar im Ersteller als Eintrag *dieser Welt* neben dem SRD.

**Nicht das Ziel:** Den SRD-Katalog aus dem Code in die Datenbank zu verschieben. Und
Klassen. Beides steht in Abschnitt 7 mit Begründung.

---

## 1. Datenmodell

Zwei Dinge müssen einen Platz bekommen, und sie sind nicht dasselbe:

- **Die Einordnung** — „diese Seite ist ein Zauber". Ein einzelner Wert, änderbar wie der
  Seitentyp, abfragbar über die ganze Welt.
- **Die Werte** — Grad, Schule, Klassenlisten. Ein Datensatz, der nur existiert, wenn die
  Einordnung gesetzt ist, und dessen Form von der Einordnung abhängt.

### Entscheidung

| Was | Wohin | Warum |
|---|---|---|
| Einordnung | **Neue Spalte `Page.gameDataKind GameDataKind?`** + `@@index([worldId, gameDataKind])` | Sie ist eine Eigenschaft der Seite wie `type`, `canonicalStatus` und `questStatus` — dieselbe Ebene, dasselbe Formular, dieselbe Server Action. Und sie ist die eine Frage, die *häufig* und *quer über die Welt* gestellt wird („alle Zauber dieser Welt, freigegeben"). Das muss ein Index-Range-Scan sein, kein Full-Table-Scan. |
| Werte | **Neue Tabelle `GameDataEntry`**, 1:1 an `Page`, `pageId @unique`, `data Json`, `onDelete: Cascade` | Exakt die Form, die `StructuredStatblock` (`schema.prisma:990`) und `StructuredItem` (`:2685`) schon zweimal etabliert haben. Die Werte sind pro Art verschieden und werden nie einzeln gefiltert — die Filterachse ist die Einordnung, und die liegt oben. |

### Warum nicht anders

**Warum kein neuer `PageType`.** Jeder `PageType` braucht einen Eintrag in
`PAGE_TYPE_TO_NAV` (`packages/database/src/page-types.ts:32-57`) und damit ein
URL-Segment; die Editroute wirft `notFound()`, wenn Kategorie und Typ auseinanderlaufen
(`edit/page.tsx:78`). „Zauber" hat keine sinnvolle Nav-Kategorie, und das Typ-Dropdown
wüchse von 24 auf 33 Optionen für alle Seiten, die das nie brauchen. Die Einordnung ist
**orthogonal** zum Typ: eine Spezies-Seite bleibt `lore`, eine Waffe bleibt `item`, ein
Zauber wird `rule`. Vorgaben dafür stehen in Abschnitt 5.

**Warum nicht `Page.tags`.** Tags sind `Json?` ohne Enum, ohne Check, ohne UI-Validierung:
`"zaube"` ist von `"zauber"` durch nichts zu unterscheiden — die Levenshtein-Suche in
`tag-service.ts:641` existiert genau deshalb. Auf SQLite unterstützt Prisma keine
JSON-Filter, also wäre jede Katalogabfrage ein Full-Table-Scan in Node
(so macht es der Graph-Filter heute, `graph-service.ts:209-211`). Dazu kollidieren die
Zwecke: `removeTags` in der Massenbearbeitung (`page-bulk-service.ts:84`) würde eine Seite
mit einem Klick aus ihrer Spieldaten-Klasse werfen, die Volltextsuche würde „Zauber" als
Treffer ausspucken, und der KI-Kontext bekäme `Tags: spieldaten/zauber` als Prosa serviert
(`ai-brain/src/context/budget.ts:29`). Und `EntityTag` hilft nicht: `entityId` hat **keinen
FK zu `Page`**, `Tag.key` ist global statt welt-gescoped, kein Seiten-Speicherpfad
befüllt die Tabelle, und die Json→EntityTag-Migration steckt laut
`tag-service.ts:257-266` mitten drin. Neue Semantik auf eine offene Baustelle zu legen,
verdoppelt sie.

**Warum kein `ContentBlockType` mit `metadata`.** `updatePageAction` schreibt beim
Speichern nur `type`, `sortOrder`, `content`, `assetId` — `metadata` bleibt
unangetastet (`apps/studio/app/actions.ts:66-86`). Ein Katalogeintrag in
`ContentBlock.metadata` wäre also von Anfang an ein Feld, das die Hauptspeicherroute
nicht kennt, ohne Unique-Zwang (eine Seite könnte drei Zauber-Blöcke haben) und ohne
Abfragbarkeit. Der bestehende `ContentBlockType statblock` ist ein warnendes Beispiel:
Er ist ein *Markdown-Textblock* und hat mit `StructuredStatblock` nichts zu tun — zwei
Dinge, gleicher Name, seitdem kostet jede Codesuche Zeit.

**Warum `kind` nur auf `Page` und nicht zusätzlich auf `GameDataEntry`.** Zwei Kopien
desselben Wertes laufen irgendwann auseinander. Der Preis ist, dass man `GameDataEntry`
nicht allein parsen kann — man muss wissen, welche Art es ist. Das ist kein Verlust: kein
Leser will den Datensatz ohne Titel, Slug und Freigabe-Häkchen, joint also ohnehin.
`parseGameData(kind, raw)` nimmt die Art als Argument.

### Schema

```prisma
/// Was eine Wiki-Seite regeltechnisch ist.
///
/// Orthogonal zu `PageType`: der Typ sagt, wo die Seite im Wiki einsortiert ist,
/// diese Einordnung sagt, wofür der Charakter-Ersteller sie benutzen darf.
/// `null` (Vorgabe) heisst: gewoehnliche Wiki-Seite, kein Katalogeintrag.
enum GameDataKind {
  species
  lineage
  background
  feat
  spell
  weapon
  armor
  gear
  language
}

model Page {
  // …
  gameDataKind GameDataKind? @map("game_data_kind")
  // …
  gameData GameDataEntry?

  @@index([worldId, gameDataKind])
}

/// Die strukturierten Werte einer Katalogseite. Form haengt von
/// `Page.gameDataKind` ab; `parseGameData(kind, data)` ist der einzige Leser.
model GameDataEntry {
  id        String   @id @default(cuid())
  worldId   String   @map("world_id")
  pageId    String   @unique @map("page_id")
  data      Json
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  world World @relation(fields: [worldId], references: [id], onDelete: Cascade)
  page  Page  @relation(fields: [pageId], references: [id], onDelete: Cascade)

  @@index([worldId])
  @@map("game_data_entries")
}
```

### Migration

`packages/database/prisma/migrations/20260806160000_wiki_spieldaten_katalog/migration.sql`

```sql
ALTER TABLE "pages" ADD COLUMN "game_data_kind" TEXT;
CREATE INDEX "pages_world_id_game_data_kind_idx" ON "pages"("world_id", "game_data_kind");

CREATE TABLE "game_data_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "game_data_entries_world_id_fkey" FOREIGN KEY ("world_id")
      REFERENCES "worlds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "game_data_entries_page_id_fkey" FOREIGN KEY ("page_id")
      REFERENCES "pages" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "game_data_entries_page_id_key" ON "game_data_entries"("page_id");
CREATE INDEX "game_data_entries_world_id_idx" ON "game_data_entries"("world_id");
```

Additiv, nullable, kein Backfill, kein Tabellen-Rebuild — die risikoarme Sorte. Nur `uwe.db`
(Brain und Family sind nicht betroffen; `generate-brain-schema-split.mjs` schreibt die
Aufteilung aus `PRISMA_MODEL_BOUNDARIES`).

**Drei Pflichteinträge daneben, sonst wird der Build rot oder das Feature fällt still hinten runter:**

1. `packages/product-contracts/src/prisma-model-boundaries.ts` —
   `GameDataEntry: U("dnd_world", "dm_only")`, dieselbe Zeile wie `StructuredItem:192`.
   Die Seite entscheidet über Sichtbarkeit, nicht der Datensatz.
2. `packages/backup/src/core-backup-coverage.test.ts` — **in `BACKED_UP_CORE_MODELS`,
   nicht in die `// GAP`-Liste.** `StructuredItem` und `StructuredStatblock` stehen dort
   als GAP, weil sie nur ein Editor schreibt und drei Exportfunktionen lesen. Ein Katalog
   ist Querschnitt; er gehört ins logische Backup. Also auch `packages/backup/src/collect.ts`
   und `restore.ts` mitziehen.
3. `packages/shared-ui/src/StatusBadges.tsx` — `GAME_DATA_KIND_LABELS`, neben
   `PAGE_TYPE_LABELS:101` und `QUEST_STATUS_LABELS:126`.

### Wo der Code liegt

Neues Feature-Package **`packages/game-data`** (`@uwe/game-data`) — nicht
`packages/database`, das sagt die Modul-Disziplin für neue Domänen-Services klar.

```
packages/game-data/src/
  types.ts           GameDataKind-Drafts, Vorgabewerte
  kinds/species.ts   parse + validate + Vorgabe je Art (je < 120 Zeilen)
  kinds/spell.ts
  kinds/…
  parse.ts           parseGameData(kind, raw) — die Weiche
  service.ts         createGameDataService(db): get/upsert/delete/listForWorld
  to-catalog.ts      buildWorldCatalog(seiten) → WorldCatalog (@uwe/character-creator)
  extract.ts         Import-Extraktor (Abschnitt 5)
```

**Parse-Disziplin:** `parseGameData` läuft in der Service-Schicht, beim **Lesen und beim
Schreiben** — Vorbild `magic-item-service.ts:26-31`, nicht `structured-statblock-service.ts`.
Der Statblock validiert nur in der Client-Komponente (`StatblockStudioPanel.tsx:107`), die
Server Action macht `JSON.parse` und schreibt; wer die Action direkt aufruft, schreibt
beliebiges JSON. Solange das Ergebnis ein Markdown-Ausdruck ist, ist ein kaputtes Feld ein
hässliches Etikett. Sobald der Ersteller damit rechnet, ist es ein falsches Charakterblatt.

---

## 2. Feldformat je Inhaltsart

### Was die Seite schon hergibt (nichts davon wird eingegeben)

| Katalogfeld | Quelle | Anmerkung |
|---|---|---|
| `key` | `Page.slug` | `slugifyDe` liefert `[a-z0-9-]+`, erfüllt `/^[a-z0-9][a-z0-9_-]*$/`; `@@unique([worldId, slug])` garantiert Eindeutigkeit in der Welt |
| `name` | `Page.title` | |
| `nameEn` | `data.nameEn` oder `name` | Optional; für Eigeninhalte ist `nameEn = name` ehrlich |
| `hook` | `Page.summary` | Fällt auf den ersten Satz der Beschreibung zurück |
| `description` | Seiten-HTML, **DM-Bereiche geschnitten** | siehe Kasten unten |
| `source` | `{ book: world.name, license: "Eigene Welt", origin: "world", pageSlug }` | Automatisch |

> **Invariante:** Der Katalog wird für das Portal gebaut. `description` läuft **immer**
> durch `stripDmSections` (`packages/auth/src/dm-section.ts:293`), unabhängig davon, wer
> gerade lädt — nicht durch `filterBlocksForViewer` mit dem Kontext des Aufrufers, sondern
> bedingungslos. Ein Katalog ist ein Cache-Kandidat und wandert in `Character.features`;
> was einmal drin steht, kommt nicht zurück. Ein Test hält das fest.

### Die strukturierten Felder

Legende: **P** = Pflicht · *(Vorgabe)* = vorbelegt, kann so stehen bleiben.

#### `species` — Spezies · 3 Felder

| Feld | Typ | | Vorgabe |
|---|---|---|---|
| `size` | `tiny\|small\|medium\|large` | P | `medium` |
| `speed` | Zahl (Fuß) | P | `30` |
| `darkvision` | Zahl oder „keine" | P | keine (`null`) |
| `traits` | Liste `{name, description}` | | leer |

`speed` und `darkvision` sind die einzigen zwei Werte, die der Ersteller wirklich rechnet
(`rules/derive.ts:171-173`). `null` ≠ `0` — „diese Spezies sieht nichts" muss explizit
durchkommen. `size` ist reines Bogenfeld plus ein Hinweistext.
**Kein Attributsbonus-Feld**, siehe Abschnitt 7.

#### `lineage` — Abstammung · 0 Pflichtfelder

Eine Abstammung ist eine **Unterseite** der Spezies-Seite (`Page.parentPageId`) — die
Beziehung ist damit schon modelliert, hat einen FK und steht im Wiki-Baum. Kein neues Feld.

| Feld | Typ | | Vorgabe |
|---|---|---|---|
| `speed` | Zahl oder „nicht überschreiben" | | nicht überschreiben |
| `darkvision` | Zahl / „keine" / „nicht überschreiben" | | nicht überschreiben |
| `traits` | Liste `{name, description}` | | leer |

Dreiwertig, weil `derive.ts:173` bewusst auf `!== undefined` prüft.

#### `background` — Hintergrund · 4 Felder

| Feld | Typ | | Vorgabe |
|---|---|---|---|
| `abilityOptions` | genau 3 aus 6 Attributen | P | leer |
| `skills` | genau 2 aus 18 Fertigkeiten | P | leer |
| `originFeat` | Auswahl aus Talenten mit `category: origin` (SRD **und** Welt) | P | — |
| `startingGold` | Zahl (GM) | P | `50` |
| `toolProficiency` | Text | | leer |
| `equipment` | Textzeilen (reine Anzeige) | | leer |

`abilityOptions` mit exakt 3 ist die härteste Regel im ganzen Katalog: die gesamte
Attributsverteilung hängt daran (`derive.ts:116-138`). `originFeat` muss auflösen, sonst
zeigt der Bogen den rohen Schlüssel als Namen (`character-json.ts:180`) — deshalb Dropdown
statt Textfeld.

#### `spell` — Zauber · 3 Pflichtfelder, 6 vorbelegte

| Feld | Typ | | Vorgabe |
|---|---|---|---|
| `level` | 0–9 | P | `1` |
| `school` | 8 Schulen | P | `evocation` |
| `lists` | Mehrfachauswahl über die 12 SRD-Klassenschlüssel, ≥1 | P | leer |
| `castingTime` | Text | | `1 Aktion` |
| `range` | Text | | `Selbst` |
| `duration` | Text | | `Sofort` |
| `components` | 2 Haken + Materialtext | | V ✓, G ✓, M leer |
| `concentration` / `ritual` | Haken | | aus |

`lists` ist eine **Auswahl, kein Freitext**. Das schließt die Falle, dass eine eigene
Zauberliste (`spellList`) und ein Klassenschlüssel auseinanderlaufen — die UI wählt über
`spellcasting.spellList || dndClass.key` (`SpellsStep.tsx:339`), der Server prüft über
`spellsForClass(dndClass.key, …)` (`character-draft-validation.ts:286`). Solange es keine
Welt-Klassen gibt (Stufe 1: gibt es nicht), kann das nicht divergieren.

#### `weapon`, `armor`, `gear` — je 3 Felder, ein gemeinsamer Editor

| Feld | Typ | | Vorgabe |
|---|---|---|---|
| `weight` | Zahl (Pfund) oder „unbekannt" | | unbekannt |
| `valueCp` | Zahl (**Kupfermünzen**) | | `0` |
| `notes` | Freitext | | leer |

Alle drei sind im Katalog dieselbe Struktur (`EquipmentLine`, `types.ts:218`) und bekommen
deshalb dasselbe Formular; die Einordnung entscheidet nur, in welchen Topf sie kommen.
`notes` trägt die Kampfdaten als Prosa („1W12 Hieb, Schwer, Zweihändig") — bewusst
unstrukturiert (`derive.ts:83-90`). Fehlt `weight`, meldet der Ersteller die Traglast als
„unvollständig", er rechnet nicht falsch.

#### `feat` — Talent / Merkmal · 2 Felder

| Feld | Typ | | Vorgabe |
|---|---|---|---|
| `category` | `origin\|general\|fighting_style\|epic_boon` | P | `origin` |
| `benefits` | Liste `{name, description}`, ≥1 | P | ein leerer Eintrag |
| `prerequisite` | Text | | leer |

Auf Stufe 1 ist nur `origin` wählbar (`custom-background.ts:176`); die anderen Kategorien
werden gespeichert und angezeigt, aber nicht angeboten. `prerequisite` wird **nicht
geprüft**, nur gezeigt.

#### `language` — Sprache · 1 Feld

| Feld | Typ | | Vorgabe |
|---|---|---|---|
| `rarity` | `standard\|rare` | P | `standard` |

### Und ein Auffangbecken

Jede `data`-Nutzlast trägt `extras: Record<string, unknown>` — alles, was der Parser nicht
kennt, überlebt den Rundlauf unverändert. Das ist die eine Sache, die
`statblock-structured-model.ts:270-277` richtig macht: das Formular deckt zehn Felder ab,
eine Importquelle bringt fünfzig, und die vierzig gehen beim Speichern nicht verloren.

### Die Antwort auf „wie viel muss ich ausfüllen?"

Eine eigene Spezies: **drei Auswahlfelder** (Größe, Tempo, Dunkelsicht), davon zwei
vorbelegt, plus beliebig viele Merkmale als reiner Fließtext. Ein eigener Zauber: **drei**
Pflichtangaben, der Rest vorbelegt. Das geht, weil `Trait.description` nirgends ausgewertet
wird — jede Fähigkeit, die keine Zahl in der Vorschau ändert, ist Prosa.

### Wie es ins Studio kommt

Zwei Ebenen, beide gibt es schon:

**Ebene A — die Einordnung** als zweites `Select` direkt unter „Typ" in
`apps/studio/app/worlds/[worldSlug]/[category]/[slug]/edit/page.tsx:167`, im selben großen
Formular, gespeichert von `updatePageAction`. Natives `<select>` mit `NATIVE_SELECT_CLASS`
(Vorbild `QuestStatusEditPanel.tsx:8-21`), weil eine Leer-Option gebraucht wird („Keine
Spieldaten") und Radix `value=""` nicht kann. Die Konstante wandert bei diesem zweiten
Nutzer nach `apps/studio/src/components/ui/`.

Bei der Gelegenheit: `updatePageAction` liest heute roh und castet
(`type: formData.get("type") as PageType`). `pageUpdateSchema` existiert seit langem in
`packages/security/src/schemas/actions.ts:509` und hat **keinen einzigen Importer**. Das
neue Feld wird über `parseFormDataOrThrow` verdrahtet und nimmt die bestehenden Felder mit.

**Ebene B — die Werte** als `GameDataEditPanel` in der Reihe der typabhängigen Panels,
zwischen `ItemBuilderSection` (`:370`) und „Erweiterte Werkzeuge" (`:372`). Bedingung ist
`page.gameDataKind !== null` statt `page.type === …` — der einzige Unterschied zu den vier
Geschwistern (`FactionStateEditPanel`, `QuestStatusEditPanel`, `CharacterSheetEditPanel`,
`ItemBuilderSection`). Bauform Section (async Server Component, liest per Service, `return
null`) + Panel (Client), wie `ItemBuilderSection.tsx:14-33`. Eigene Server Action
`game-data-actions.ts` mit `requireStudioActionAuth()` → `requireStudioContentEdit()` →
`parseFormDataOrThrow` → Service → `revalidatePath`.

Das Panel schaltet sein Formular über die Art um (`useState`, Vorbild
`ContentBlockBody.tsx:45`) und bietet daneben einen JSON-Modus als Notausgang, wie das
Statblock-Panel (`:142-159`).

---

## 3. Wie es in den Ersteller kommt

Der Ersteller ist heute rein clientseitig: jeder Schritt importiert die Katalog-Arrays auf
Modulebene (`SpeciesStep.tsx:33`, `ClassStep.tsx:34`, `EquipmentStep.tsx:31`), und die
`find*` sind freie Funktionen über diese Arrays (`content/index.ts:59-127`). Der Katalog
liegt gemessen als **177 KB / 48,6 KB gzip** in *einem* Route-Chunk
(`characters/neu/page-*.js`, 297 KB gesamt) — route-lokal, gehasht, sitzungsübergreifend
gecacht.

### Schritt 1: `createCatalog` in `@uwe/character-creator`

Neue Datei `src/catalog-runtime.ts`:

```ts
export interface WorldCatalog {
  species: Species[];
  backgrounds: Background[];
  feats: Feat[];
  spells: Spell[];
  weapons: EquipmentLine[];
  armor: EquipmentLine[];
  gear: EquipmentLine[];
  languages: Language[];
}

export const EMPTY_WORLD_CATALOG: WorldCatalog = { … };

/** SRD + Welt, zusammengeführt. Welt-Einträge verdecken SRD-Einträge gleichen Schlüssels. */
export function createCatalog(world: WorldCatalog): Catalog;
```

`Catalog` trägt die Arrays **und** die bekannten Nachschlagefunktionen als Methoden:
`findSpecies`, `findClass`, `findLineage`, `findSubclass`, `findBackground`,
`resolveBackground`, `originFeats`, `spellsForClass`, …

Die bestehenden freien Exporte bleiben und werden zu Delegaten auf
`SRD_CATALOG = createCatalog(EMPTY_WORLD_CATALOG)`. **Bestandscode bleibt gültig, Verhalten
unverändert** — das ist der Punkt: es gibt einen grünen Zwischenzustand, und die
~10 Dateien, die `StepProps` durchreichen, wandern danach einzeln.

**Verdecken statt Präfix:** Ein Welt-Eintrag mit `key: "mensch"` ersetzt den SRD-Eintrag
„Mensch" in dieser Welt. Kein `welt-`-Präfix, weil (a) der Schlüssel dann nicht mehr der
Seiten-Slug wäre, (b) „ich will einen anderen Menschen" der eigentliche Wunsch ist und
(c) gespeicherte Charaktere (`Character.species` JSON) einen Schlüssel tragen, der nach
dem Löschen des Welt-Eintrags wieder auf den SRD-Eintrag zeigt — die Degradation ist
gutartig. Die Studio-Prüfliste warnt, wenn eine Seite einen SRD-Schlüssel verdeckt.

### Schritt 2: Transport — Props, hybrid

`neu/page.tsx` ist bereits eine `async` Server Component, macht bereits die Auth-Arbeit
und reicht bereits eine Server-Sache (`createAction`) in den Wizard. Ein zweites Prop ist
formgleich zum Bestand:

```tsx
const worldCatalog = await loadWorldCatalog(db, world.id); // @uwe/game-data
return <CharacterWizard worldSlug={worldSlug} createAction={…} worldCatalog={worldCatalog} />;
```

Der Wizard baut daraus einmal `useMemo(() => createCatalog(worldCatalog), [worldCatalog])`
und gibt `catalog` über `StepProps` nach unten.

**Hybrid, und zwar bewusst:** Der SRD-Teil bleibt im Bündel. Als Props wäre er
RSC-Flight-Payload — 48 KB gzip *bei jedem Seitenaufruf* statt einmal als gehashte Datei.
Gleiche Drahtgröße, schlechteres Cache-Verhalten. Über die Leitung geht nur das Welt-Delta;
eine Welt mit 50 eigenen Einträgen sind wenige KB.

**Keine API-Route.** Es gäbe einen Präzedenzfall (`PortalGraphView.tsx:25-58`), aber der
kauft einen Spinner mitten in Schritt 1, braucht einen Eintrag in
`PORTAL_SESSION_API_ROUTES` (`route-policy.ts:111-128` — ohne ihn läuft es lokal
einwandfrei und liefert auf dem Host 404, weil `evaluatePortalMiddleware:37-39` außerhalb
von Produktion kurzschließt), und er ersetzt den serverseitigen Loader trotzdem nicht.
Wenn der Katalog je zu groß wird, ist der Notausgang eng umrissen: **nur Zauber**, nur auf
`SpellsStep`, den `needsSpellStep` (`steps.ts:106`) ohnehin schon aussperrt.

**Keine lesende Server Action.** Es gibt im Portal keine, `character-actions.ts` ist
dateiweit `"use server"`, jeder neue Export wird ein öffentlicher POST-Endpunkt.

### Schritt 3: Die Serverseite — nicht optional

Das ist der Teil, der die Reihenfolge bestimmt. `createFullCharacterAction` prüft den
Entwurf komplett gegen den Katalog nach (`character-actions.ts:70-83`; der Kommentar dort
sagt es wörtlich: „Was der Browser geprüft hat, zählt an dieser Stelle nichts"), und
`packages/player-hub/src/character-draft-validation.ts` importiert dafür ~20 Symbole aus
`@uwe/character-creator`. Ohne Umstellung würde ein Charakter mit Welt-Spezies vom eigenen
Server abgelehnt.

Also: `validateCharacterDraft(input, { catalog })`, und die Action lädt denselben
Welt-Katalog wie die Seite. **Der Loader ist die erste Arbeit, nicht die letzte** — der
Transport zur UI ist danach eine Zeile.

### Schritt 4: Paketgrenze beachten

`packages/character-creator/src/index.ts` sagt wörtlich: „hier liegt nichts, was einen
Server braucht." Der Prisma-lesende Loader gehört deshalb in `@uwe/game-data`, nicht in
diesen Einstieg — sonst schlägt `scripts/client-server-boundary.test.ts` zu.
`@uwe/character-creator` bekommt nur `catalog-runtime.ts`, und das ist reiner TypeScript.

### Schritt 5: Der Entwurf im sessionStorage veraltet jetzt

`useDraft.ts:33-59` speichert nur Schlüssel und merged beim Zurücklesen über `emptyDraft()`
— **ohne jede Katalogprüfung**. Heute ungefährlich, weil der Katalog eine Build-Konstante
ist. Mit Welt-Inhalten: der DM löscht eine Spezies, der wiederhergestellte Entwurf zeigt
auf einen toten Schlüssel, `findSpecies` liefert `undefined`, Vorschau und Rail leeren sich
stumm — während das Banner „Entwurf aus dieser Sitzung wiederhergestellt" Erfolg meldet
(`CharacterWizard.tsx:239-259`).

Fix in `readStored`: Schlüssel gegen den übergebenen Katalog prüfen, tote fallen lassen,
und das **sichtbar** melden („Deine Spezies-Wahl gibt es nicht mehr — bitte neu wählen").
Der Speicherschlüssel ist bereits welt-getrennt (`useDraft.ts:19-23`), das reicht nicht.

---

## 4. Herkunft

`ContentSource` (`types.ts:61-66`) bekommt zwei Felder dazu — additiv, beide optional für
Bestandscode:

```ts
export interface ContentSource {
  book: string;      // "SRD 5.2.1" | Weltname
  license: string;   // "CC-BY-4.0" | "Eigene Welt"
  origin?: "srd" | "world";
  /** Nur bei origin === "world": Slug der Wiki-Seite. */
  pageSlug?: string;
}
```

`SRD_SOURCE` bekommt `origin: "srd"`. Ein String-Vergleich auf `book` wäre der falsche
Diskriminator — Weltnamen sind frei.

**Wo es sichtbar wird:**

1. **Auf der Kachel** — ein kleines Abzeichen „Aus deiner Welt" auf den Auswahlkarten in
   `SpeciesStep`, `BackgroundStep`, `SpellsStep`, `EquipmentStep`. Nicht andersherum: SRD
   ist der Normalfall und bleibt unmarkiert.
2. **In der Detailspalte** — Zeile „Quelle: *Weltname* · **Zur Wiki-Seite**", verlinkt auf
   `/auth/worlds/<welt>/wiki/<pageSlug>`. Der Link ist immer gültig, weil nur freigegebene
   Seiten überhaupt in den Katalog kommen.
3. **Beim Verdecken** — verdeckt ein Welt-Eintrag einen SRD-Schlüssel, steht auf der Kachel
   „Ersetzt den SRD-Eintrag". Sonst sucht ein Spieler den vertrauten Eintrag und findet ihn
   nicht.
4. **Auf dem fertigen Bogen** — `Character.species` und `.background` schreiben `source`
   ohnehin mit (`character-json.ts`), das trägt die Herkunft dauerhaft.
5. **Filter** — ein Umschalter „Nur SRD / Alles" in den Schritten mit vielen Einträgen
   (Zauber). Billig, weil `origin` am Eintrag hängt.

---

## 5. Der Import-Weg

Zwei Hebel, weil die zwei Betriebsarten des Imports verschieden gebaut sind.

### (a) Frontmatter-Schlüssel `spieldaten` — für `wiki_pages` (eine Datei = eine Seite)

Neuer `CanonicalKey "gameData"` in `packages/doc-import/src/dialect.ts`:

| Kanonisch | Aliase |
|---|---|
| `gameData` | `spieldaten`, `spieldaten-typ`, `game-data`, `gamedata` |

Werte deutsch, aufgelöst über eine Tabelle nach dem Muster von `resolvePageTypeLabel`
(`page-type-detect.ts:17-71`):

```
spezies | volk | species        → species
abstammung | untervolk | lineage → lineage
hintergrund | background        → background
talent | merkmal | feat         → feat
zauber | spell                  → spell
waffe | weapon                  → weapon
ruestung | rüstung | armor      → armor
ausruestung | gegenstand | gear → gear
sprache | language              → language
```

Unbekannter Wert → `null`, keine Ausnahme, Warnung in der Vorschau. Das ist die Nachsicht,
die der Dialekt überall zeigt (`canonical-status.ts:80`, `resolvePageTypeLabel`), und sie
gilt weiter.

**Die Root-only-Regel ist hier kein Problem, im `document`-Modus aber eine Falle.**
Frontmatter wird ausschließlich auf die Wurzelseite angewandt (`tree-mapper.ts:328`). Ein
Kampagnenband mit 60 Zaubern kann darüber genau *einen* Eintrag vorfüllen. Deshalb setzt
`spieldaten:` im `document`-Modus nur die Wurzel, und die Vorschau sagt das auch — für
alles andere gibt es (b).

**`Page.type` wird gleich mitgesetzt**, wenn im Frontmatter keiner steht:

| Einordnung | `PageType` | Nav |
|---|---|---|
| `species`, `lineage`, `background` | `lore` | Lore |
| `spell`, `feat`, `language` | `rule` | Lore |
| `weapon`, `armor`, `gear` | `item` | Handouts |

Kein neuer `PageType`. Ein ausdrückliches `typ:` gewinnt weiter.

### (b) `uwe-daten`-Codezaun — pro Abschnitt, für `document`

~~~markdown
## Feuerhand

```uwe-daten
art: zauber
grad: 1
schule: hervorrufung
listen: magier, hexenmeister
wirkzeit: 1 Aktion
konzentration: ja
```

Ein Strahl aus Flammen springt von deiner Hand …
~~~

Grammatik **identisch zum Frontmatter-Dialekt** — `key: wert`, deutsche Schlüssel,
Kommalisten, kein YAML. `parseFrontmatterBody` (`frontmatter.ts:138-189`) wird
wiederverwendet, inklusive des Prototype-Pollution-Schutzes (`:49-53`). `art:` ersetzt in
dieser Form den Frontmatter-Schlüssel.

Was dafür anzufassen ist — vier Dateien, wie schon kartiert:

| Datei | Änderung |
|---|---|
| `doc-import/src/types.ts` | Datenslot auf `DocumentNode` (`:34-61`) und auf `PageDraft` (`:119-139`) |
| `doc-import/src/semantic/restructure.ts` | Zaun aus `node.body` herauslösen (`doc-tree.ts:22` kennt Codezäune bereits, der Block überlebt den Baumbau) |
| `doc-import/src/writer.ts` | Zweig neben `if (pageType === "item")` (`:180`) |
| `game-data/src/extract.ts` | `parseGameData` auf die Nutzlast |

Der `writer.ts`-Zweig ist strukturell derselbe Eingriff wie der bestehende Magic-Item-Haken
— inklusive der Fehlerkapselung (`:191-199`): schlägt die Extraktion fehl, bleibt die Seite
stehen und es gibt eine Warnung, kein abgebrochener Import.

### (c) Nachschlag, Stufe 2: aus dem Fließtext raten

Der Extraktor für Magic Items liest heute schon strukturierte Werte aus fertigem
Seiten-HTML (`semantic/item-extract.ts:206-296`): Seltenheit aus der Kopfzeile, Eigenschaften
aus `Eigenschaften`/`Werte`-Abschnitten und zweispaltigen Tabellenzeilen. Dasselbe Muster
liest „**Grad** 1 · **Schule** Hervorrufung" und einen `## Merkmale`-Abschnitt mit
`**Name.** Text`-Zeilen. Deterministisch, degradiert zu `null`, keine Dialekt-Änderung.
Aber: Raten kommt nach dem Deklarieren, nicht davor.

### (d) Eine Lücke, die dabei zufällig geschlossen wird

`knownFrontmatterKeys()` und `resolveFrontmatterKey()` (`dialect.ts:114-121`) haben
**keinen einzigen Aufrufer**, und kein Test friert die Schlüsselliste ein — ein Alias kann
heute stillschweigend verschwinden. Wer den Dialekt erweitert, schreibt den Snapshot-Test
gleich mit und zeigt die Liste in der Import-Vorschau an.

### (e) Was der Import *nicht* macht

`StructuredStatblock` wird vom Import bis heute nie befüllt, obwohl `restructure.ts` mit der
Rolle `statblock_values` schon eine eigene Unterseite dafür erzeugt. Das ist eine echte
Lücke — aber eine andere. Sie gehört nicht in diesen Entwurf, und dieser Entwurf sollte sie
nicht stillschweigend miterben.

---

## 6. Migrationspfad SRD-Katalog

**Beide Quellen bleiben nebeneinander. Der SRD-Katalog bleibt TypeScript.**

Begründung, nach Gewicht:

1. **Eine frische Installation muss ohne Welt-Inhalte einen Charakter bauen können.** Wandert
   der SRD in die Datenbank, hängt der Ersteller an einem Seed. Ein fehlgeschlagener oder
   halb gelaufener Seed ist dann kein leerer Wiki-Baum, sondern ein kaputtes Kernfeature.
2. **`catalog-integrity.test.ts` prüft heute gegen den Compiler.** Tote `originFeat`-Verweise,
   Zauber ohne Klassenliste, Klassen ohne Unterklasse, zu wenige Zauber für
   `cantripsKnown` — all das ist ein roter Build. In der Datenbank wäre es ein Datenzustand,
   den niemand bemerkt, bis ein Spieler auf eine leere Liste guckt.
3. **Der Chunk ist heute gehasht und gecacht.** In der Datenbank wird derselbe Inhalt zu
   Payload bei jedem Aufruf (siehe Abschnitt 3).
4. **Die Lizenz-Attribution ist an einer Stelle einfacher ehrlich zu halten.** CC-BY-4.0
   verlangt Namensnennung; ein `SRD_SOURCE`-Konstante im Code ist schwerer versehentlich zu
   überschreiben als eine Spalte in einer editierbaren Tabelle.
5. **Die Richtung, die man braucht, ist nur eine.** Welt-Einträge ergänzen und verdecken
   SRD-Einträge. Das Gegenteil — den SRD im Wiki editieren — löst kein Problem: wer einen
   anderen Menschen will, schreibt seinen eigenen.

**Ausdrücklich kein Backfill.** 84 Zauber, 9 Spezies, 19 Talente in jede Welt zu schreiben,
bläht Wiki, Suche, Graph, Backup und Import-Vorschau auf, damit sich hinterher nichts ändert.

**Die eine Brücke, Stufe 4:** eine Studio-Aktion „SRD-Eintrag als Wiki-Seite übernehmen" —
sie legt eine Seite an, setzt die Einordnung und füllt `GameDataEntry` mit den Werten des
SRD-Eintrags vor. Das ist der Kopieren-und-ändern-Weg, und er macht das Verdecken zu einer
bewussten Handlung. Das Muster gibt es schon: `EquipmentSearchBox.tsx` +
`applySrdEquipmentToItemAction` in der Item-Werkbank.

Sollte sich das je umkehren — etwa weil UWE mehrere Regelwerke tragen will — ist der Weg
offen: `WorldCatalog` ist die Schnittstelle, und der SRD kann derselben Form entsprechen.
Das ist dann ein Austausch der Quelle, keine Umschreibung des Erstellers.

---

## 7. Was nicht geht

Ehrlich, damit niemand es in Stufe 1 versucht:

**Klassen und Unterklassen.** Der teuerste Fall, und nicht wegen einzelner Felder:

- **Zwei verschachtelte Pflichtlisten.** Mindestens eine Unterklasse — selbst ein voller
  Katalogeintrag mit eigenen Merkmalen — und mindestens eine Startausrüstungs-Option mit
  Posten und Gold. Eine Wiki-Seite „Meine Klasse" ist damit nicht eine Seite, sondern eine
  Seite plus n Unterklassen-Seiten plus eine Postenliste.
- **Die Zauberliste hängt am falschen Ende.** `Spell.lists` zeigt von den Zaubern auf die
  Klassen. Wer eine eigene Zauberklasse anlegt, muss **jeden** Zauber anfassen, den sie
  bekommen soll — auch die 84 SRD-Zauber, die im Code stehen und nicht editierbar sind.
- **`spellList` vs. `key`.** Browser und Server lösen die Zauberauswahl über verschiedene
  Schlüssel auf; eine eigene Klasse mit abweichender `spellList` bietet Zauber an, deren
  Speichern dann abgelehnt wird. Kein Test erzwingt die Konvention.
- **~14 Pflichtfelder plus zwei Unterobjekte** — das ist ein eigener Editor, keine
  Formularsektion unter einer Wiki-Seite.

Klassen kommen in Stufe 5 als eigenes Vorhaben, oder gar nicht.

**Ausrüstungspakete.** `packFor`/`gearFor` (`EquipmentStep.tsx:44,57`) verbinden über den
deutschen **Anzeigenamen**, nicht über den Schlüssel. „Entdeckerpaket" ≠ „Entdecker-Paket":
der Eintrag verschwindet nicht, aber Gewicht und Wert fallen still aus der Summe. Erst den
Join auf Schlüssel umstellen, dann Welt-Pakete zulassen.

**Attributsboni an der Spezies.** SRD 2024 vergibt die +2/+1 ausschließlich über den
Hintergrund; es gibt kein Feld an `Species`. Eine importierte 2014er-Spezies mit „+2 STÄ"
verliert das — der Satz wird ein Merkmalstext. Das ist Absicht und wird beim Import als
Hinweis gemeldet, nicht heimlich verworfen.

**Rüstungsklasse aus Rüstung.** `ArmorProfile` (`derive.ts:91-95`) existiert, aber kein
Katalogfeld füllt es; die RK steht als Prosa in `notes`. Eine Welt-Rüstung kann die
Vorschau also gar nicht falsch rechnen — sie kann sie auch nicht richtig rechnen.

**Merkmalstexte auswerten.** `Trait.description` wird nie geparst. „Einmal pro kurzer Rast
kannst du …" hat keine Wirkung auf dem Bogen. Genau dieser Verzicht macht das Feature
klein; wer ihn aufgibt, baut eine Regel-Engine.

**Voraussetzungen prüfen.** `Feat.prerequisite` wird angezeigt, nicht durchgesetzt. Dasselbe
gilt für `concentration` und `ritual` — sie sehen aus wie Regelfelder und sind Abzeichen.

**Zauber über Grad 1.** Speicherbar, aber der Ersteller baut Stufe-1-Charaktere. Das
Grad-Feld erlaubt 0–9, der Ersteller zeigt 0 und 1.

**Bilder.** `art` verweist auf einen Pfad unter `public/character-creator/` — extern geladene
Bilder verbietet die CSP (`img-src 'self' data: blob:`). Welt-Bilder müssten same-origin
über `/api/assets/*/file` laufen. Heute ohnehin gegenstandslos:
`CHARACTER_ART_AVAILABLE = false`.

**Bearbeiten im Portal.** Spieldaten werden im Studio gepflegt. Das Portal liest — und auch
nur, was `portalReleased` freigegeben hat.

**Eine einzelne Abstammung** ist erlaubt (der Spieler klickt die eine an), auch wenn
`catalog-integrity.test.ts:159` für den SRD `>1` verlangt. Das ist eine Inhaltsqualitäts-
Regel für den Code-Katalog, keine Laufzeitbedingung. Die Studio-Prüfliste weist darauf hin.

---

## 8. Aufwand in Stufen

### Stufe 0 — Fundament · ~1,5 Tage

Enum, `Page.gameDataKind`, `GameDataEntry`, Migration. `PRISMA_MODEL_BOUNDARIES`,
Backup-Aufnahme (`collect.ts`, `restore.ts`, Coverage-Test). Paket `@uwe/game-data`:
`types.ts`, `parse.ts`, `kinds/*`, `service.ts`, Tests für Parser (Vorgabewerte,
Rundlauf, unbekannte Schlüssel → `extras`).

### Stufe 1 — Kleinster nützlicher Schnitt · ~3–4 Tage

**Nur `species` und `spell`.** Das sind die zwei Arten, bei denen der Ersteller sichtbar
etwas anderes tut: eine Spezies ändert Tempo und Dunkelsicht in der Vorschau, ein Zauber
erscheint in der Auswahlliste. Waffe und Rüstung sind reine Anzeige, Hintergrund ist der
teuerste der einfachen — beide warten.

- Studio: Einordnungs-Dropdown im Hauptformular, `pageUpdateSchema` verdrahten
- Studio: `GameDataEditSection` + `GameDataEditPanel` mit den zwei Formularen + JSON-Modus,
  eigene Server Action
- `@uwe/character-creator`: `catalog-runtime.ts` mit `createCatalog`, freie Funktionen als
  Delegaten (grüner Zwischenzustand)
- `@uwe/game-data`: `loadWorldCatalog` inkl. `stripDmSections` und Freigabe-Filter
- Portal: Props in `neu/page.tsx`, `catalog` durch `StepProps`, `SpeciesStep` und
  `SpellsStep` auf den Katalog umstellen
- **Server-Gegenprüfung**: `validateCharacterDraft(input, { catalog })` in `player-hub`,
  Katalog in `createFullCharacterAction` laden
- Herkunfts-Abzeichen + Quellenzeile mit Wiki-Link
- `readStored`: tote Schlüssel fallen lassen und melden

**Ab hier funktioniert das Feature.** Ein DM legt eine Wiki-Seite an, wählt „Spezies", trägt
drei Werte ein, gibt die Seite frei — und sie steht im Ersteller.

### Stufe 2 — Die restlichen Arten · ~2 Tage

`background`, `feat`, `weapon`, `armor`, `gear`, `language`, `lineage`. Je ein Parser und
ein Formularabschnitt (weapon/armor/gear teilen sich einen), Anbindung an
`BackgroundStep`, `EquipmentStep`, `DetailsStep`. Der Hintergrund braucht die
Talent-Auswahl über SRD **und** Welt.

### Stufe 3 — Import · ~2 Tage

Frontmatter `spieldaten:` inkl. Wertetabelle und Typ-Vorgabe. `uwe-daten`-Zaun: Datenslot
auf `DocumentNode` und `PageDraft`, Herauslösen in `restructure.ts`, Zweig in `writer.ts`.
Tests in `dialect.test.ts`, `tree-mapper.test.ts`, `writer.test.ts` (gegen echte SQLite-DB,
wie der Magic-Item-Test `:216-240`). Schlüsselliste einfrieren.

### Stufe 4 — Komfort · ~2 Tage

„SRD-Eintrag übernehmen". Studio-Prüfliste: verdeckte SRD-Schlüssel, tote
`originFeat`-Verweise, Zauber ohne Klassenliste, Hintergrund ohne drei Attribute, Einträge
auf nicht freigegebenen Seiten. Fließtext-Extraktor (5c). MCP-Tool
`studio_world_game_data`. Skills nachziehen (`/uwestudio`, `/uweportal`, `pnpm skills:sync`
— `scripts/area-skills-sync.test.ts` erzwingt es).

### Stufe 5 — Klassen

Eigenes Vorhaben. Nicht Teil dieses Entwurfs. Voraussetzung: Ausrüstungs-Join auf
Schlüssel, `spellList`-Konvention per Test erzwungen, ein Umkehrindex für `Spell.lists`.

---

## Prüfliste vor dem Merge

- [ ] `GameDataEntry` in `PRISMA_MODEL_BOUNDARIES` **und** in `BACKED_UP_CORE_MODELS`
- [ ] `stripDmSections` im Katalog-Loader, mit Test
- [ ] Nur `portalReleased`-Seiten im Katalog, mit Test
- [ ] `parseGameData` läuft beim Lesen *und* beim Schreiben, nicht nur im Client
- [ ] Serverseitige Entwurfsprüfung kennt den Welt-Katalog
- [ ] Jede neue Datei < 300 Zeilen; `scripts/file-size-baseline.json` unverändert
- [ ] Kein neuer `PageType`, kein neuer Eintrag in `PAGE_TYPE_TO_NAV`
- [ ] `pnpm quality` grün, inkl. `catalog-integrity.test.ts` und `client-server-boundary.test.ts`

## Verwandte Dokumente

- [character-creator-offene-punkte.md](character-creator-offene-punkte.md) — der offene
  Punkt „welt-eigene Inhalte" ist genau dieses Vorhaben
- [character-creator-missing-data.md](character-creator-missing-data.md)
- [doc-import-und-session-runner.md](doc-import-und-session-runner.md) — Frontmatter-Dialekt
- [access-model.md](access-model.md) — Häkchen, Welt-Zuordnung, `:::dm`
- [studio-shell.md](studio-shell.md) — wohin eine neue Studio-Sektion gehört
- [database-service-map.md](database-service-map.md)
