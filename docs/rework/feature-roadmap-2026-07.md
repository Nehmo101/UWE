# UWE Feature-Roadmap 2026-07 — Wellen 1–4

Stand: 2026-07-03 · Eingabe: Owner-Ideenliste (DnD-Studio, Privatbereich, Betrieb, Dokumentenscanner) · Code-Audit auf Branch `claude/uwe-terra-features-t0stvj` (nach PR #429/#430).

> **Zweck.** Priorisiert die aktuelle Ideenliste in vier Wellen und gleicht sie mit dem
> **realen Code-Stand** ab. Ergänzt [FEATURE_BACKLOG_PLAN.md](../FEATURE_BACKLOG_PLAN.md)
> (Wellen A–D, abgeschlossen) — bei Abweichungen gilt der Code. Detailpläne für Welle 1
> liegen daneben in `docs/rework/`.

---

## 0. Code-Abgleich (TL;DR)

Mehrere Ideen sind weiter als die Backlog-Docs (Stand 2026-07-01) behaupten:

| Idee | Doku sagt | Code sagt |
|------|-----------|-----------|
| `nextSession`-Bug im Portal | „Fix in Arbeit" | **Behoben**: `getPortalDashboard` nutzt `listVisibleToPlayersForPortal` + `playerVisibleSchedule` (`packages/database/src/auth.ts`, `portal-dashboard-service.ts`) |
| Quest Builder | „Dedizierte Builder-UI fehlt" | **Vorhanden**: `QUEST_SCHEMA` (patron/objective/twist/failure/reward) + NPC-Picker (`structured-generator-schemas.ts`, `QuestBuilderPanel.tsx`) |
| Session-Live-Modus | „Kein dedizierter Live-Modus" | **Leichtgewichtig vorhanden**: `/worlds/[slug]/sessions/[id]/live` + `session-live-actions.ts` (Notes-Autosave, Timestamp-Append) |
| Wiki-Qualität | — | **Fundament vorhanden**: `world-inspector.ts` mit 16 Finding-Codes + Fix-Actions; Auto-Linking aus PR #430 (`wikitext-convert-service.ts`) |

Nirgends vorhanden: **OCR/Vision** (nur `pdf-text-extract.ts` für PDFs mit Textlayer; der
RTX-Connector-Executor ist text-only — der `vision`-Workflow-Slot existiert nur als
Konfiguration), **Essensplaner** (keine Food-Modelle; `packages/cookbook` ist
LLM-Modell-Auswahl), **persistiertes Todo/Reminder-Modell** (Alerts sind read-time-derived).

**Aufgehobene Scope-Grenze (Owner-Entscheidung 2026-07-03):** „never build: meal planner,
household inventory, document vault" aus dem Daily-Admin-OS-Scope ist revidiert.
Scan Inbox und Küche/Essensplaner sind jetzt offizielle Module (siehe
`.cursor/skills/daily-admin-os/SKILL.md` und
[prompts/UWE_DAILY_ADMIN_OS_CURSOR_PROMPTS.md](../prompts/UWE_DAILY_ADMIN_OS_CURSOR_PROMPTS.md)).

---

## 1. Welle 1 — Detailgeplant, als Nächstes bauen

| Feature | Kern | Fundament | Detailplan |
|---------|------|-----------|------------|
| Session-Live-Modus (Ausbau) | Live-Panel → Spieltisch-Cockpit + Review→Kanon | bestehendes `/live`, `ai-review-service.ts` | [session-live-mode-plan.md](session-live-mode-plan.md) |
| Wiki-Aufräumzentrale | Pflege-Cockpit mit neuen Checks + Bulk-Fixes | `world-inspector.ts`, PR #430 | [wiki-quality-center-plan.md](wiki-quality-center-plan.md) |
| Scan Inbox Phase S0+S1 | Upload→OCR→Vorschlag→Bestätigung, private Doks | Capture/Assets/Connector-Queue | [scan-inbox-plan.md](scan-inbox-plan.md) |
| Essensplaner Phase K1 | Rezept-CRUD + Tags | net-new `packages/kitchen` | [meal-planner-plan.md](meal-planner-plan.md) |

## 2. Welle 2 — Direkt anschließend

> **Umsetzungsstand 2026-07-03:** Startklar-Wizard gebaut — `/system/startklar`
> aggregiert Changelog seit zuletzt bestätigter Version, Env-Warnungen
> (`validateUweEnvironment`), Migrationsstatus, Backup-Alter und offene Aufgaben;
> „Als gelesen markieren" speichert die Version in den Settings. 5 Unit-Tests.
> Portal-Hub-Ausbau gebaut — „Fragen an den DM" (`PlayerQuestion` +
> `player-question-service`, Portal-Formular + Studio-Antwortseite, 4 Tests);
> Gruppeninventar/offene Quests waren bereits im Portal vorhanden.
> Scan Inbox **S0** (Vision-Enabler) gebaut — Connector-Capability `vision_local`
> + Job `vision_extract` + RTX-Executor (Ollama `images`); S1 (Doku-Pipeline) folgt.

- **Scan Inbox S2 — DnD-Scan-Modi**: Sessionnotiz → Recap-Proposal (über bestehenden
  AiProposal-Review, kein Auto-Kanon), Dungeon-Zettel → Draft-Page, Handout →
  Draft-Page mit SecretLevel-Blöcken. Charakterbögen bewusst nicht.
- **Essensplaner K2 — Wochenplan + Einkaufsliste**: Wochengrid, Routinen
  („Freitag Pizza" als Wochen-Vorlage), Mengen-Konsolidierung, Grundausstattung.
- **Portal „Vor der nächsten Runde"-Hub (Ausbau)**: `nextSession` funktioniert bereits;
  ergänzen: Gruppeninventar (`PartyTreasury` existiert), offene Quests (`questStatus`
  existiert), „Fragen an den DM" (net-new, kleines Modell + Studio-Eingang).
- **Startklar-Wizard (`/system/startklar`)**: Aggregation aus vorhandenen Bausteinen —
  Changelog seit letztem Besuch (`changelog.ts` + net-new „last seen version" pro User),
  Env-Änderungen (`packages/auth/src/env-validation.ts`-Issues), Migrationsstatus
  (`getMigrationStatus`), Backup-Alter (`next-actions.ts`), neue Admin-Aufgaben
  (Onboarding-Checklist-Muster), Links zu betroffenen Seiten. Motivation: harte
  Env-Checks aus PR #429 sollen beim Deploy nie wieder überraschen.

## 3. Welle 3 — Sichtbarer Mehrwert, mittlerer Aufwand

> **Umsetzungsstand 2026-07-03:** Kampagnen-Radar gebaut (`campaign-radar-service.ts`,
> read-only Aggregation, Seite `/worlds/[slug]/radar`, 7 Tests). Essensplaner K2
> (Wochenplan + Einkaufsliste) gebaut — siehe `meal-planner-plan.md`.
> Health-Ampel gebaut (`health-metrics-service.ts`: DB-Größe, größte Tabellen,
> Upload-Volumen, Connector-Erreichbarkeit + Ampel-Logik; Seite `/system/health`,
> 7 Tests). Magic-Item-Werkbank gebaut (`StructuredItem`-Modell + `magic-item-model.ts`
> pure Export Homebrewery/5e.tools/Spieler-Handout mit DM-Geheimnis-Trennung,
> Werkbank-Seiten `/worlds/[slug]/magic-items`, 14 Tests).

- **Kampagnen-Radar** („Was passiert gerade in der Welt?"): fast reine Lese-Aggregation
  über `FactionState`, offene Quests (`quest-lifecycle-service.ts`), `WorldCalendar`,
  `WorldEvent`, letzte Session, NPC-Zustände, Kanon-Konflikte
  (`canon-conflict-service.ts`). Kaum Schema-Änderungen.
- **Magic-Item-Werkbank**: `ITEM_SCHEMA` existiert; ergänzen: sichtbare Beschreibung vs.
  DM-Geheimnis, Fluch, Attunement, Seltenheit; Export im Muster
  `statblock-structured-export.ts` (5e.tools/Homebrewery), Labeldruck via
  `label-service.ts`, Spieler-Handout über bestehende Handout-/Share-Mechanik.
- **Health-Ampel für echte Nutzung**: `getSystemStatus()`/`/api/health` erweitern um
  DB-Größe, größte Tabellen, Upload-Volumen, langsame Seiten (einfaches Timing),
  Portal-/RTX-Erreichbarkeit; UI auf Basis Owner-Cockpit/`/admin/status`.
- **Essensplaner K3**: Vorratskammer, Ablaufdaten, „Koche mit X, Y, Z", KI-Vorschläge
  (RTX-only über Connector-Queue).
- **Scan Inbox S3**: Rezept-Scan → Rezept-Entwurf in `@uwe/kitchen` (Brücke, = K4).

## 4. Welle 4 — Später / opportunistisch

> **Umsetzungsstand 2026-07-03:** „Mach weiter"-Zentrale gebaut
> (`continue-work-service`, Seite `/continue`, 3 Tests) und Finanz-/Abo-Übersicht
> (`finance-overview-service`, Seite `/finance`, 6 Tests) — beide read-only.
> Offen: Prompt-/Agenten-Bibliothek, One-Shot-Generator, Haushalts-Cockpit,
> Wissensassistent mit Quellenpflicht.

- **Prompt-/Agenten-Bibliothek in UWE**: Fundament `packages/agent-jobs/src/presets.ts`
  (Platzhalter-Felder existieren); ausbauen zu `PromptTemplate`-CRUD + Kategorien +
  „Als Cursor/Claude-Prompt kopieren" + „Als Agent Job starten" + Ergebnis-Verknüpfung.
  Backlog nennt „Feature Registry: Prompt-CRUD" bereits als offen.
- **One-Shot-Generator aus Terra-Kanon**: structured-generator + brain-Kontext,
  kanon-safe, Spielerwissen beachtet; sinnvoll nach dem Kampagnen-Radar.
- **Haushalts-Cockpit**: Verträge/Hardware existieren; ergänzt Mülltermine/Wartungen —
  nutzt `CalendarEvent` als Termin-Primitiv (siehe Querschnitts-Entscheidung unten).
- **Finanz-/Abo-Übersicht**: weitgehend vorhanden (`ContractExpense` inkl.
  Kündigungsfristen, Kosten-Rollups, AI-Kosten-Sync); Rest = „lohnt sich noch?"-Ansicht
  + Preisverlauf.
- **„Mach weiter wo ich aufgehört habe"-Zentrale**: Aggregation über Captures,
  `PersonalProject.nextAction`, offene Agent-Jobs, unfertige Prep; nach Scan Inbox.
- **Wissensassistent mit Quellenpflicht**: auf `personal-brain-search`/Chunks aufbauend;
  Antwort + UWE-Quelle + Unsicherheit. Größte KI-Aufgabe, bewusst zuletzt.

---

## 5. Querschnitts-Entscheidungen

1. **Reminder-Primitiv**: Es gibt bewusst kein gespeichertes Todo/Reminder-Modell.
   Abgeleitete Alerts bleiben Standard (Muster `buildContractAlerts()` → `/today`);
   wo echte Termine nötig sind, wird `CalendarEvent` (`kind: personal`) verwendet.
   Kein neues Notification-System in diesen Wellen.
2. **Privacy**: Alles Private (Scans, Rezepte, Life-Brain) läuft RTX-only — bei neuen
   Modulen **per Konstruktion** über die Connector-Queue statt über neue
   AiContextModes (kein Cloud-Codepfad). DnD-KI folgt der bestehenden Gateway-Policy
   (`CLOUD_ALLOWED_CONTEXT_MODES`).
3. **Modul-Disziplin**: Neue Domänen als Feature-Packages (`packages/scan-inbox`,
   `packages/kitchen`), nicht in `packages/database`; neue Symbole über Package-Roots,
   nie über das eingefrorene `@uwe/database/server`-Barrel.
4. **Dual-Schema**: Jede Migration wird in `schema.prisma` **und**
   `schema.postgresql.prisma` (+ `migrations-postgresql/`) gepflegt.

## 6. Risiken

1. `AiProposal.worldId` ist non-nullable — private (welt-lose) Scans nutzen deshalb
   JSON-Proposals auf dem Scan-Datensatz; das Schema wird dafür **nicht** geändert.
2. Vision auf dem Connector ist net-new; der vorhandene `vision`-Slot täuscht Fertigkeit
   vor. Phase S0 realistisch budgetieren (Modell-Download/VRAM auf dem RTX-Host).
3. Bild-Payloads reisen als Base64 in `connector_jobs.payload_json` — Downscale
   zwingend, mehrseitige PDFs seitenweise/gecappt.
4. File-Size-Budget (max. 700, Ziel < 300 Zeilen): Extraktions-Schemas und
   Merge-Logik von Tag 1 pro Concern splitten.
