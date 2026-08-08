# NPC & Character Species Migration Plan

**Stand:** 2026-08-08  
**Workstream:** npc-migration (Scan abgeschlossen)  
**Inventar:** `legacy-species-inventory.json`, `species-discovered.json`, `npc-species-scan.json`

---

## 1. Ausgangslage

| Speicherort | Feld | Inhalt heute |
|---|---|---|
| `Character.species` | JSON (`CharacterSpeciesJson`, schema v1) | `speciesKey`, optional `lineageKey`, `size` (Default aus Katalog) |
| `Page.type = npc` | Wiki-Body | Freitext/Markdown — **kein** `species`-JSON |
| `Page.type = player_character` | Verknüpfung zu `Character` | Species über Character-Zeile |
| Lokale Demo-DB (`uwe.db`) | Abfrage 2026-08-08 (nach Seed) | **0** Character-Zeilen, **1** Welt (Terra), **8** Pages, **0** NPC-Seiten |

Legacy-SRD-Spezies (`drachenblutige`, `zwerg`, … `tiefling`) bleiben im Katalog. Neue Owner-Einträge kommen über `species-extended.ts` dazu — **kein** Löschen alter Keys in Phase 1.

### 1.1 Katalog-Key-Policy (Scan 2026-08-08)

| Frage | Ergebnis |
|---|---|
| `Character.species`-Zeilen in `uwe.db` | **0** — strukturierte Species-Migration **N/A** |
| NPC-Seiten mit Species-JSON | **Keine** — Wiki-Prosa only |
| Legacy-SRD-Keys löschen? | **Nein — RETAINED** |
| Owner-Namen (Drascari, Arkadia, Sun Elves, …) | Werden als **`existing-srd`-Remaps** auf die neun SRD-Keys gemappt, **nicht** als Ersatz-Keys eingeführt |
| Keys entfernen wegen Duplikaten? | **Nur** wenn parallel umgeschriebene Katalogeinträge existierten — **tun sie nicht**; kein Lösch-Schritt |
| NPC-Wiki | Inventar-only; optionaler Prosa-Review **später**, wenn Terra-NPC-Korpus wächst |

Die neun Keys in `SPECIES_SRD` (`species.ts`) bleiben unverändert. `species-discovered.json` dokumentiert Remaps (`mapsTo` / `catalogKey`), keine Phase-1-Deletion.

---

## 2. Character.species JSON — Remap-Regeln

### 2.1 Bestehendes Schema (unverändert)

```typescript
// packages/player-hub/src/character-json.ts
interface CharacterSpeciesJson {
  schemaVersion: 1;
  speciesKey: string;
  lineageKey?: string;
  size?: "medium" | "small";
}
```

### 2.2 Remap-Tabelle (Owner-Name → Katalog-Key)

| Owner / Quellname | Ziel-`speciesKey` | `lineageKey` | Hinweis |
|---|---|---|---|
| Drascari | `drachenblutige` | SRD-Drachen-Ahnen-Key | Kein separater Drascari-Key |
| Dwarves (Lore) | `zwerg` | — | SRD bleibt |
| Halflings (Lore) | `halbling` | — | SRD bleibt |
| Humans | `mensch` | — | SRD bleibt |
| Orcs | `ork` | — | SRD bleibt |
| Sun Elves | `elf` | `hochelf` / `waldelf` / `drow` | Spieler wählt SRD-Abstammung |
| Moon Elf | `elf` | **blocked** | Custom Lineages — Owner-Entscheidung |
| Arkadia | `tiefling` | `infernalisch` / … | Fiendish Legacy = SRD-Tiefling |
| Goblinkin → Goblin | `goblinkin` | `goblin` | Neu importiert |
| Goblinkin → Hobgoblin | `goblinkin` | `hobgoblin` | Neu importiert |
| Goblinkin → Bugbear | `goblinkin` | `bugbear` | Neu importiert |
| Fukuro, Felin, … | gleichnamiger Key | — | Siehe `species-discovered.json` → `importedKeys` |

### 2.3 Migrations-Skript (wenn DB > 0 Characters)

1. `SELECT id, species FROM Character WHERE species IS NOT NULL`
2. Für jede Zeile: JSON parsen, `speciesKey`/`lineageKey` über Remap-Tabelle ersetzen
3. Unbekannte Keys → `dev-progress/species-discovered.json` prüfen; sonst Draft-Validierung blockiert (`player-hub` character-draft-validation)
4. **Kein** automatisches Rewrite von Wiki-NPCs

**Heute:** 0 Zeilen → Skript dokumentiert, nicht ausführen.

---

## 3. NPC (`Page.type = npc`) — Wiki-Text-Scan

NPCs haben **kein** strukturiertes Species-Feld. Migration = **Inventar**, kein JSON-Backfill.

### 3.1 Scan-Strategie

```sql
SELECT id, title, slug, content
FROM Page
WHERE type = 'npc' AND worldId = :terraWorldId;
```

Pro Seite (case-insensitive, Wortgrenzen):

| Suchbegriff (DE/EN) | Vermuteter Katalog-Key |
|---|---|
| Drachenblütige, Dragonborn, Drascari | `drachenblutige` |
| Zwerg, Dwarf, Dwarves | `zwerg` |
| Elf, Elfe, Sun Elf, Moon Elf | `elf` |
| Gnom, Gnome | `gnom` |
| Goliath, Jötnar | `goliath` / `jotnar` (Kontext) |
| Halbling, Halfling | `halbling` |
| Mensch, Human | `mensch` |
| Ork, Orc | `ork` |
| Tiefling, Arkadia | `tiefling` |
| Goblin, Hobgoblin, Bugbear, Goblinkin | `goblinkin` + lineage |
| Lizardfolk, Echsenmensch | `lizardfolk` |
| Minotaur, Minotaurs | `minotaur` |
| … | siehe `importedKeys` in `species-discovered.json` |

### 3.2 Ergebnis-Nutzung

- **Phase 1:** Markdown-Report `npc-species-scan.json` (pageId, title, hits[], suggestedKey)
- **Phase 2 (optional):** DM-only Frontmatter oder Infobox-Feld — **nicht** in Phase 1
- **Portal-Leak:** Species-Namen in NPC-Text sind Spieler-sichtbar nur wenn Page visibility es erlaubt — Scan respektiert `dm_only`-Filter beim Export

---

## 4. Reihenfolge & Risiken

1. Katalog erweitern (`species-extended.ts`) — **done (Erstbatch)**
2. Portal-Wizard / Draft-Validation: neue Keys in `@uwe/character-creator` SPECIES whitelisten (automatisch via Katalog)
3. Wenn Owner Legacy-Namen in alten Exporten hat: Remap-Tabelle anwenden
4. NPC-Scan nach Seed mit Terra-NPCs (optional QA)
5. Später: `sizeChoice`-Persistenz (bekannte Lücke in `legacy-species-inventory.json`)

### Risiken

| Risiko | Mitigation |
|---|---|
| Doppelte Spezies (Drascari vs. Drachenblütige) | Remap auf SRD-Key; kein zweiter Katalogeintrag |
| Eingeklappte PDF-Traits (Kenku, Satyr, …) | `blocked` in `species-discovered.json`; nachreichen wenn Owner Traits liefert |
| 0 Characters | Kein Datenverlust; Remap-Skript idle |

---

## 5. Scan-Ergebnis (2026-08-08, nach Seed)

Ausführlicher Report: `npc-species-scan.json` (Skripte: `_scan-npc-species.mjs`, `_query-species.mjs`).  
Seed-Status: `workstreams/seed-scan.json`.

| Metrik | Wert |
|---|---|
| DB geseedet | **Ja** (`pnpm --filter @uwe/database db:seed`) |
| Welten in `uwe.db` | **1** (Terra, `cmskg6exs000i5k7g88c83xy6`) |
| Pages gesamt | **8** (region/location/faction — kein `type=npc`) |
| `Page.type = npc` (alle Welten) | **0** |
| `Page.type = npc` (Terra) | **0** |
| `Character.species` JSON | **0** Zeilen |
| Species-Treffer in NPC-Prosa | **0** |
| `terra-seed.ts` NPC-Seiten | **0** (nur region/location/faction) |
| Species-Treffer in Seed-Quelltext | **0** |
| Migration-Map (`npc-species-migration-map.json`) | **nicht erzeugt** — 0 Character.species-Zeilen |

**Migration status:** **N/A** für strukturierte Species — weder Character-JSON noch NPC-Metadaten zu migrieren.

**Katalog:** Legacy-Keys **RETAINED** (merged as `existing-srd` per Remap-Tabelle §2.2); **keine** Key-Deletion.

## 6. Nächste Schritte

- [x] NPC-Scan (DB + `terra-seed.ts`) — **done**; siehe `npc-species-scan.json`
- [ ] Phase-2-Import: Ifrit, Kathai, Oodoon, Mucosi, Automaton, … (`outcome: discovered`)
- [ ] Owner-Entscheidung Moon-Elf-Lineages vs. SRD-Elf
- [ ] Optional (später): Wiki-Prosa-Review für NPC-Species-Nennungen, wenn `Page.type=npc` > 0
- [ ] Art-Assets unter `/character-creator/species/` für erweiterte Völker (optional)
