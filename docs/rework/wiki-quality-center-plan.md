# Detailplan: Wiki-Aufräumzentrale (Qualitäts-Cockpit)

Stand: 2026-07-03 · Teil von [feature-roadmap-2026-07.md](feature-roadmap-2026-07.md) (Welle 1).

> **Umsetzungsstand 2026-07-03:** Erste Scheibe gebaut — `wiki-quality-service.ts`
> (6 Checks: `unlinked_term`, `thin_page`, `npc_missing_relations`,
> `location_missing_map`, `quest_missing_status`, `duplicate_alias`) + UI-Seite
> `/worlds/[worldSlug]/quality` + Nav-Eintrag „Wiki-Pflege" + 13 Unit-Tests.
> Fundstellen sind aktuell navigierend (Link zur Seite); der Bulk-Auto-Link-Fix für
> `unlinked_term` verweist zunächst auf die bestehende Auto-Verlinkung unter `/import`
> (dedizierter Bulk-Button auf der Quality-Seite folgt).

**Ziel:** Nach der Bulk-Konvertierung mit Auto-Verlinkung (PR #430) der nächste
logische Schritt: ein Pflege-Cockpit `/worlds/[worldSlug]/quality`, das alle
Qualitäts-Checks bündelt — unverlinkte Begriffe, dünne Seiten, NPC ohne
Fraktion/Ort, Orte ohne Karte, Quests ohne Status, doppelte Aliase, Spielersicht.
Kein Neubau: Erweiterung des vorhandenen World-Inspectors.

---

## 1. Ist-Stand (wiederverwenden)

- `packages/database/src/world-inspector.ts` (611 Z., Bestands-Monolith → **nicht
  anbauen**, Baseline-Regel): 16 Finding-Codes (u. a. `broken_wiki_link`,
  `orphan_page`, `duplicate_name`, `hidden_link_in_portal_page`, Safety-Checks wie
  `gm_note_player_visible`), `InspectorFinding`-Struktur mit stabilen IDs,
  `InspectorFixAction` + `inspector-fix-service`, UI `/worlds/[worldSlug]/inspector`.
- `wikitext-convert-service.ts` (PR #430): `autoLinkWikitext` mit Dry-Run + Apply +
  per-Block-Undo + Activity-Log; `buildWikitextLinkTerms` (Titel vor Aliasen).
- `quest-lifecycle-service.ts` (`Page.questStatus`), `FactionState`, `AtlasNode`/Maps,
  `Page.aliases` (Json) + `PageLink` (typisierte Links), `normalizeLookupKey`
  (`slug-utils.ts`), `SettingsService`, Portal-Permissions (`permissions.ts`).

## 2. Neue Finding-Quelle: `packages/database/src/wiki-quality-service.ts`

Neue Datei statt Anbau an `world-inspector.ts` (Baseline eingefroren). Liefert
`InspectorFinding[]`-kompatible Findings (gleiche Struktur, stabile IDs, Severity,
Fix-Suggestions), damit die bestehende Finding-Anzeige/Fix-Maschinerie
wiederverwendet werden kann. Neue Codes:

| Code | Erkennung | Fix-Action |
|------|-----------|------------|
| `unlinked_term` | Page-Titel/Aliase kommen im Fließtext anderer Seiten unverlinkt vor → Detektor = `buildWikitextLinkTerms` + `autoLinkWikitext`-Dry-Run | Link setzen (wikitext-convert pro Seite, mit Undo) |
| `thin_page` | Fließtext unter Schwellwert (Default ~300 Zeichen, über `SettingsService` konfigurierbar) | — (Link zur Seite) |
| `npc_missing_relations` | NPC-Page ohne `PageLink` zu faction/location | — (Link zum Seiten-Editor) |
| `location_missing_map` | location/region ohne Asset `type=map` und ohne AtlasNode-Referenz | — (Link zu Atlas/Assets) |
| `quest_missing_status` | `type=quest` ohne `questStatus`, oder lange „open" ohne Session-Bezug | Status setzen (quest-lifecycle) |
| `duplicate_alias` | gleicher `normalizeLookupKey` auf mehreren Seiten (Titel/Alias-Kollision — schärfer als bestehendes `duplicate_name`) | — (Konfliktliste) |

Regeln: read-only Berechnung aus vorhandenen Daten (kein AI-Zwang, wie der Inspector);
pro Check eine kleine, pure, testbare Funktion; Datei < 300 Zeilen, sonst pro
Check-Gruppe splitten (`wiki-quality/*.ts`).

## 3. „Spielersicht prüfen"

Keine Duplikation: die bestehenden Safety-Findings des World-Inspectors
(`gm_note_player_visible`, `secret_page_portal_visible`, `share_link_unprotected`, …)
werden in der neuen UI als eigener Tab **mit angezeigt** (gemeinsame Datenquelle,
eine Oberfläche für „Welt aufräumen").

## 4. UI `/worlds/[worldSlug]/quality`

- Karten pro Check-Kategorie mit Zählern (Aufräum-Fortschritt sichtbar), Filter nach
  Severity/Code/Seitentyp.
- Einzel-Fix über bestehende `InspectorFixAction`-Maschinerie + die neuen Actions.
- **Bulk-Fix nur für `unlinked_term`**: über wikitext-convert Dry-Run → Vorschau →
  Apply (mit vorhandenem Undo + Activity-Log). Alle anderen Checks bleiben
  Einzelentscheidungen — passt zur Review-Philosophie.
- Inspector-Seite (`/inspector`) verlinkt auf die Quality-Seite und umgekehrt.
- Optional (klein): Zähler-Badge in `/open-items` bzw. als Next-Action
  (`next-actions.ts`), wenn kritische Findings existieren.

## 5. Verifikation

- Unit-Tests je Finding-Code mit synthetischen Page-Fixtures (Muster: bestehende
  world-inspector-Tests): positive + negative Fälle, stabile Finding-IDs,
  Schwellwert-Konfiguration für `thin_page`.
- `unlinked_term`-Detektor gegen die PR-#430-Testfälle (Code-Fences, bestehende
  Links, Headings dürfen nicht anschlagen).
- Manuelle Probe auf der Terra-Welt: Zähler plausibel, ein Bulk-Auto-Link-Lauf mit
  Vorschau + Undo.
- `pnpm quality`.
