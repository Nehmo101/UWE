# Legacy Species Inventory — Character Creator

Generated: 2026-08-08 (Composer 2.5 existing-impl workstream)

## Executive counts

| Metric | Count |
|--------|------:|
| Catalog species (SRD 5.2.1) | **9** |
| Catalog lineages | **24** |
| Species with lineage choice | 5 |
| Species without lineages | 4 |
| Characters in local `uwe.db` | **0** |
| Characters with `species` JSON | **0** |
| Characters without `species` JSON | **0** |

Local DB query: `packages/database/data/uwe.db` via Prisma. From repo root:

```bash
pnpm exec tsx packages/character-creator/dev-progress/_query-species.mjs
# or
pnpm exec tsx packages/character-creator/dev-progress/_query-species.ts
```

The dev seed does not create `Character` rows; species JSON only appears after Portal wizard completion.

---

## Data model: no separate Species or NPC tables

UWE stores species **only** on player character sheets:

- **Table:** `characters` (`Character` model in `packages/database/prisma/schema.prisma`)
- **Column:** `species Json?` (nullable JSON blob)
- **Migration:** `packages/database/prisma/migrations/20260701120000_wave_c0b_character_inventory/migration.sql` — `"species" JSONB`

There is **no** `Species`, `Lineage`, or `Npc` Prisma model.

### NPCs vs player characters

| Concept | Storage | Species data? |
|---------|---------|---------------|
| **Player character (sheet)** | `Character` row + optional `Page` (`type: player_character`) | Yes — `Character.species` when created via wizard |
| **NPC (wiki)** | `Page` with `type: npc` | **No** — prose/stat blocks in wiki content, not structured species JSON |
| **Monster** | `Page` / structured statblocks | Separate from character creator catalog |

NPC counts in campaign cockpit (`packages/campaign-cockpit`) query `Page.type = "npc"`, not `Character.species`.

---

## Existing implementation map

### 1. `@uwe/character-creator` (`packages/character-creator/`)

Framework-agnostic SRD catalog + rules. No Prisma, no React.

| Area | Path | Role |
|------|------|------|
| Types / draft contract | `src/types.ts` | `Species`, `SpeciesLineage`, `CharacterDraft.speciesKey`, `CREATOR_STEPS` |
| Species catalog | `src/content/species.ts` | `SPECIES` (9 entries), `findSpecies()` |
| Lineages | `src/content/species-lineages.ts` | 5 lineage arrays (24 total) |
| Catalog barrel | `src/content/index.ts` | Re-exports + `findLineage(speciesKey, lineageKey)` |
| Other catalogs | `src/content/classes-*.ts`, `backgrounds.ts`, `feats.ts`, `equipment.ts`, `spells-*.ts`, `misc.ts` | Classes, backgrounds, spells, etc. |
| Step validation | `src/rules/steps.ts` | Species step: requires `speciesKey` + `lineageKey` when lineages exist |
| Derived stats | `src/rules/derive.ts` | Speed/darkvision from species + lineage |
| Custom backgrounds | `src/rules/custom-background.ts` | SRD 2024 background builder |
| Integrity tests | `src/content/catalog-integrity.test.ts` | Unique keys, lineage count > 1 per species with lineages |
| Package entry | `src/index.ts` | Public exports |

### 2. Portal character wizard (`apps/portal/`)

| Path | Role |
|------|------|
| `app/auth/worlds/[worldSlug]/characters/neu/page.tsx` | Wizard route; auth gate |
| `app/auth/worlds/[worldSlug]/characters/page.tsx` | Character list |
| `app/character-actions.ts` | `createFullCharacterAction` — JSON draft → `@uwe/player-hub` |
| `src/components/character-wizard/CharacterWizard.tsx` | 9-step shell; resolves catalog via `findSpecies` / `findLineage` |
| `src/components/character-wizard/steps/SpeciesStep.tsx` | Species + lineage UI |
| `src/components/character-wizard/useDraft.ts` | `sessionStorage` draft (`speciesKey`, `lineageKey`) |
| `src/components/CharacterProfilePanel.tsx` | Displays `profile.species.name` on sheet view |

Draft persistence: browser `sessionStorage` only (not server-side until submit).

### 3. Player-hub persistence (`packages/player-hub/`)

| Path | Role |
|------|------|
| `src/character-json.ts` | **`CharacterSpeciesJson`** contract (`schemaVersion: 1`); `buildSpeciesJson()` |
| `src/character-draft-validation.ts` | Server-side re-validation; resolves species/lineage from catalog keys |
| `src/player-characters.ts` | `createFullCharacter()` writes `species`, `background`, `features`, `bio` JSON columns |

Flow: Portal → `createFullCharacterAction` → `validateFullDraft` → `buildCharacterJsonColumns` → Prisma `character.create`.

### 4. Database / export layer

| Path | Role |
|------|------|
| `packages/database/src/character-service.ts` | `CreateCharacterInput.species`, `toPortalCharacterView.profile.species` |
| `packages/database/src/character-sheet-export.ts` | Markdown/HTML export reads `profile.species.name` |
| `packages/security/src/schemas/common.ts` | `characterDraftSchema.speciesKey`, `lineageKey` (zod) |

### 5. Tests referencing species JSON

| File | Fixture |
|------|---------|
| `packages/player-hub/src/player-characters.test.ts` | `{ schemaVersion: 1, key: "elf", name: "Elf" }` |
| `packages/database/src/character-sheet-export.test.ts` | Same elf fixture |

No seed data populates `Character.species`.

---

## Catalog inventory: species keys

Source: SRD 5.2.1 (CC-BY-4.0). **Aasimar is explicitly excluded** (PHB 2024 only).

| key | name | nameEn | lineages |
|-----|------|--------|----------|
| `drachenblutige` | Drachenblütige | Dragonborn | 10 (draconic ancestries) |
| `zwerg` | Zwerg | Dwarf | — |
| `elf` | Elf | Elf | 3 |
| `gnom` | Gnom | Gnome | 2 |
| `goliath` | Goliath | Goliath | 6 |
| `halbling` | Halbling | Halfling | — |
| `mensch` | Mensch | Human | — (size choice: medium/small) |
| `ork` | Ork | Orc | — |
| `tiefling` | Tiefling | Tiefling | 3 (fiendish legacies; size choice: medium/small) |

### Lineage keys by parent species

**Drachenblütige (`drachenblutige`):** `drache-schwarz`, `drache-kupfer`, `drache-blau`, `drache-bronze`, `drache-messing`, `drache-gold`, `drache-rot`, `drache-gruen`, `drache-silber`, `drache-weiss`

**Elf (`elf`):** `drow`, `hochelf`, `waldelf`

**Gnom (`gnom`):** `waldgnom`, `felsengnom`

**Goliath (`goliath`):** `wolkenriese`, `feuerriese`, `frostriese`, `huegelriese`, `steinriese`, `sturmriese`

**Tiefling (`tiefling`):** `abyssisch`, `chthonisch`, `infernalisch`

Machine-readable full list: `legacy-species-inventory.json`.

### Size choice (`sizeChoice`) — catalog vs wizard persistence

Two species expose optional size in the SRD catalog: **`mensch`** and **`tiefling`** (`sizeChoice: ["medium", "small"]` in `species.ts`; default `size: "medium"`).

| Layer | Captures player size choice? |
|-------|------------------------------|
| Catalog (`Species.sizeChoice`) | Yes — documents allowed sizes |
| `CharacterDraft` / Portal `useDraft` | **No** — only `speciesKey` and `lineageKey`; no `sizeKey` field |
| `buildSpeciesJson()` | **No** — writes `size: species.size` (catalog default `"medium"`) |
| Persisted `Character.species` JSON | Always the default unless a future wizard step sets size before submit |

Until the wizard adds size selection and `buildSpeciesJson` accepts an override, all saved characters use **`medium`** for mensch/tiefling regardless of player intent.

---

## `Character.species` JSON shape (schema version 1)

Defined in `packages/player-hub/src/character-json.ts`:

```typescript
interface CharacterSpeciesJson {
  schemaVersion: number;  // currently 1
  key: string;            // catalog species key
  name: string;
  nameEn: string;
  size: CreatureSize;
  speed: number;
  darkvision: number | null;
  lineage: { key: string; name: string; nameEn: string } | null;
  lineageLabel: string | null;
  source: ContentSource;
}
```

Trait text lives in `Character.features`, not in `species`.

---

## Database character audit (local)

Queried 2026-08-08 against `packages/database/data/uwe.db`:

- **0** total characters
- **0** with species JSON
- **0** without species JSON

No legacy or unknown species keys in DB on this machine. Production hosts may differ — run the same query before migration.

---

## NPC / species migration scope

**In scope for species JSON migration:** `Character` rows where `species IS NOT NULL` and `json_extract(species, '$.key')` is set (after wizard use).

**Out of scope (separate workstream):** Wiki NPC pages (`Page.type = npc`). They do not use `Character.species`. Any future NPC species field would be wiki/metadata design, not this JSON column.

---

## Proposed migration plan outline (DO NOT EXECUTE)

### Phase 0 — Preconditions

1. Full DB backup (`uwe.db` or Postgres dump) with timestamp.
2. Export inventory query on target environment (counts + distinct `species.key`, `lineage.key`).
3. Freeze catalog key changes during migration window.

### Phase 1 — Mapping table

Maintain a version-controlled mapping file (template):

| old_species_key | new_species_key | old_lineage_key | new_lineage_key | action | notes |
|-----------------|-----------------|-----------------|-----------------|--------|-------|
| `elf` | `elf` | `hochelf` | `hochelf` | noop | identity |
| *(example)* | *(example)* | *(example)* | *(example)* | rename | document reason |

Actions: `noop`, `rename`, `merge`, `split`, `deprecate`.

Validate: every DB key appears exactly once; every new key exists in target catalog.

### Phase 2 — Transactional migration script

1. **Read** all characters with non-null `species` in batches.
2. **Transform** JSON in memory using mapping + `schemaVersion` bump if shape changes.
3. **Update** `features` entries where `origin` is `species`/`lineage` if display names change.
4. **Write** within a single DB transaction per batch (or one transaction if row count small).
5. **Log** `{ characterId, oldKey, newKey, changed: boolean }` to append-only migration log.

Pseudocode location (future): `scripts/migrate-character-species.mjs` — not created in this workstream.

### Phase 3 — Verification

1. Re-run inventory query; compare counts before/after.
2. Assert zero unknown keys against new catalog.
3. Spot-check sheet export (`character-sheet-export`) and Portal profile panel.
4. Run `pnpm test` for player-hub + character-sheet-export tests.

### Phase 4 — Rollback

1. Restore DB from Phase 0 backup (only supported rollback).
2. Keep migration log to replay forward after fix.
3. Do **not** partial-revert JSON in place without backup — mixed schema versions break readers.

### Phase 5 — Catalog import/removal (if keys change)

1. Update `packages/character-creator/src/content/species*.ts` first.
2. Update `catalog-integrity.test.ts` expectations.
3. Deploy app before or atomically with DB migration so `findSpecies(oldKey)` never runs against migrated DB without mapping.

---

## Related docs

- `docs/engineering/character-creator-missing-data.md` — catalog completeness vs SRD/PHB
- `docs/engineering/character-creator-offene-punkte.md` — open QA items
- `apps/portal/src/components/character-wizard/BRIEF.md` — UI design notes

---

## Art assets note

Species entries reference `/character-creator/species/<key>.svg` under Portal `public/`. No SVG files found under `apps/portal/public/character-creator/` at inventory time — UI may show fallbacks until assets land.
