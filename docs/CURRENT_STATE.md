# UWE — Current State

Kurze, eindeutige Wahrheit über den aktiven Stand. Bei Widersprüchen in anderen
Dokumenten gilt diese Datei (Runtime/CI) bzw.
[FEATURE_MATURITY_MATRIX.md](FEATURE_MATURITY_MATRIX.md) (Feature-Reifegrade).

Stand: 2026-07-28 (Doku-Sync nach Abspeckung N.3 / Häkchen-Modell / Family / Atlas-Abbau).

## Aktive Runtime

- **UWE Host** — zwei gleichwertige Pfade:
  Linux + Node.js 22 + `pnpm` + `systemd` (`deploy/systemd/uwe.service`,
  `deploy/scripts/setup-uwe-host.sh`) **oder** Windows über den Command Center
  (`apps/rtx-connector-client`, Tauri — startet Studio/Portal/Brain/Landing als
  Kind-Prozesse, Daten unter `%LOCALAPPDATA%\UWE\rtx-connector-client\host`).
- **Maschinenraum** — optionaler **outbound** Worker (`tools/uwe-rtx-connector`,
  `pnpm connector:start`). Öffnet keinen Port am RTX-PC, verbindet sich ausschließlich
  ausgehend zum Host. Siehe [rtx-connector.md](rtx-connector.md).
- **Cloudflare Tunnel / Access** — optional davor; Studio/Portal/Landing, Brain nur
  mit `BRAIN_PUBLIC_TUNNEL=1`, niemals RTX/Ollama.
- **Datenbanken** — drei SQLite-Dateien: `uwe.db` (Kern), `uwe-brain.db`
  (owner-privat), `uwe-family.db` (geteilt); optional PostgreSQL für den Kern
  (`schema.postgresql.prisma`). Grenze: `packages/product-contracts/src/prisma-model-boundaries.ts`.

**Nicht aktiv (entfernt/deprecated):** Docker, Windows-One-Click-Installer und der
inbound RTX-Agent. Details: [removed-legacy-runtime.md](removed-legacy-runtime.md).

## Aktive CI-Wahrheit

**GitHub Cloud CI ist der maßgebliche Gate.** Ein PR ist mergebar, wenn seine
GitHub-Checks grün sind:

- `pr-check.yml` → `pnpm ci:light` (jeder PR; einziger Required Check)
- `ci.yml` → volles `pnpm quality` + Postgres-Smoke (auf `main`; E2E/Perf scheduled)
- `security.yml`, `docs-check.yml` (scheduled/Pfad-gefiltert), `deploy.yml` (self-hosted Runner auf dem Host)

Lokale Befehle (`pnpm ci:light` / `pnpm quality`) sind **optionale Vorprüfung**, kein
Pflicht- oder Self-hosted-Gate. Details: [engineering/ci.md](engineering/ci.md).

## Aktive Apps

- `apps/studio` — DM-App (Port 3000): Weltbearbeitung, Admin, KI.
- `apps/portal` — Spieler-Wiki (Port 3001): nur gefilterte, freigegebene Inhalte.
- `apps/brain` — Owner-Bereich (Port 3002, loopback-bind): privater Daily-Admin-,
  Wissens- und Mail-Bereich (`uwe-brain.db`).
- `apps/family` — Familienbereich (Port 3004, loopback-bind): Verträge, Dokumente,
  Küche, Kalender (`uwe-family.db`).
- `apps/landing` — Apex-Startseite (Port 3103): genau drei Routen, keine Inhalte.
- `apps/rtx-connector-client` — Command Center (Tauri-Desktop-App): Host- und
  Connector-Verwaltung, startet die vier Web-Apps auf Windows.

Zugriff läuft über das **Häkchen-Modell** (vier Boolean-Flächen
`portal`/`studio`/`brain`/`family` pro E-Mail + `owner`); das alte Rollen-Enum
wurde am 2026-07-26 entfernt (`packages/auth/src/area-access.ts`,
[engineering/access-model.md](engineering/access-model.md)).

## Aktive Packages

39 Workspace-Packages unter `packages/` — Kern: `@uwe/database`, `@uwe/auth`,
`@uwe/security`, `@uwe/ai-brain`, `@uwe/assets`, `@uwe/shared-ui`,
`@uwe/shared-utils`, `@uwe/config`, `@uwe/env`, `@uwe/product-contracts`,
`@uwe/connector`, `@uwe/static-export`; dazu Feature-Packages (u.a. `@uwe/backup`,
`@uwe/calendar`, `@uwe/mail`, `@uwe/mail-core`, `@uwe/dnd-api`,
`@uwe/image-studio`, `@uwe/agent-jobs`, `@uwe/kitchen`, `@uwe/scan-inbox`,
`@uwe/passkeys`, `@uwe/security-tests`). Der Karteneditor **Terra** lebt außerhalb
des Workspace unter `terra/`. Aktive Tools: `tools/uwe-rtx-connector`,
`tools/uwe-host-command-center`.

## Feature-Reifegrade (Kurzfassung)

Vollständig: [FEATURE_MATURITY_MATRIX.md](FEATURE_MATURITY_MATRIX.md).

- **Stable/Core:** Worlds, Wiki, Assets, Portal, Auth, Visibility, Host Setup,
  Backup, Search, Static/Wiki Export.
- **Beta:** Calendar (inkl. CalDAV-Vollsync), DnD API, Daily Admin OS,
  Secrets/Reveal (Page + Block), Kanonprüfung, Prepare-for-next-session,
  Agent Jobs (Dispatch + Polling), Image Studio (Masken-Canvas), Import Undo,
  Auto-Backup-Scheduler, Life-Brain Retrieval — implementiert
  (RTX-Embeddings + Keyword-Fallback), Qualität RTX-abhängig;
  aus den Backlog-Wellen: Charaktersheet (Voll-5e-Kern),
  Party-Treasury/Inventar, strukturierte Generatoren (NPC/Quest/Item, Review-pflichtig),
  Statblock Studio + Exporte, Encounter-XP-Budget, „Was ist offen?“-View,
  World-Clock/Chronik/Spieler-Timeline/Faction-Sim, Kanon-Lifecycle (#392),
  Cross-Domain-Suche (#391), EntityTag-Primärquelle (#393), Unified Activity +
  Owner Cockpit (#394), Bug Center, NL-Admin-Kommandos (Whitelist), Secrets-Status,
  Admin-Checklist, Migration Inspector, Import-Zentrale (Multi-Quelle),
  Miniaturen-Sammlung, `db:deploy:safe` (Auto-Backup vor Migration).
- **Lab / nicht production-ready:** Performance-Budget / große Testwelt.
- **Deprecated/Removed:** Docker, Windows-One-Click-Installer, inbound RTX-Agent.

## Produkt-Backlog (bestätigt offen)

Offene Rest-Punkte (der frühere `FEATURE_BACKLOG_PLAN.md` wurde entfernt):

- **NL-Kommandos:** LLM-Intent-Parsing (bewusst nicht verfolgt); optionale Template-Auswahl bei `create_world`.
- **Import-Zentrale:** Obsidian-/PDF-Upload-UI (bewusst nicht verfolgt laut Produkt).
- **Tags:** Auf Produktions-Hosts nach `pnpm verify:tag-backfill` ggf. `UWE_ENTITY_TAGS_PRIMARY=true` setzen (Json-Dual-Write bei Merges aus).

Zuletzt umgesetzt (Roadmap-Welle PR #498+): NL `list_world_members`, `delete_user`, `reset_password`;
Today-Widget „Projekte nach Domäne“; Projekt-Detail mit Domänen-Modul-Links; EntityTag-Primary-Mode für Tag-Merges;
Mail-Entwürfe, Kalender-Grid, Ideas-Prompt-CRUD, Zaubergrad-Import, Weltuhr/Chronik-Nav;
Terra als Karteneditor unter `/worlds/[slug]/karten` bzw. `/auth/worlds/[slug]/karten` (löst den 3D-Weltenbauer ab,
dessen Code und Tabellen am 27.07.2026 entfernt wurden — alte Inhalte wurden per Owner-Entscheid verworfen).

**Nicht im Backlog** (bewusst nicht verfolgt): Asset-Level-Secrets, manuelle Browser-QA
über 9 Theme-Presets, vollständiges Light-Theme-Refactoring, DB↔Client-Theme-Sync,
`docs:check` für Skills-README, DnD-API-Cache-Aufräumen, Agent-Jobs-Completion-Callback;
per Beschluss (ehem. FEATURE_BACKLOG_PLAN.md §13): KI-Capture-Sortierung (LLM-Ausbau),
voller Secret-Vault, semantische Suche (Embeddings).

## Weitere bekannte Lücken (ohne festen Backlog-Slot)

- **Life-Brain Retrieval** — implementiert (Beta): RTX-Embeddings + Keyword-Fallback
  (`/api/life-brain/search`, Such-/Index-Panels + Reindex auf `/life-brain`); kein
  Cloud-Fallback, Qualität RTX-abhängig.
- **Performance** — keine Browser-LCP-Gates, nur CI-Smoke + Bundle-Budget.
- **Capture Bild-Upload** — implementiert (`/api/capture/upload`, Quick Capture); UI auf `/capture`.
- **Agent Jobs** — Dispatch + Polling funktional; kein Auto-Merge (by design, siehe [SECURITY_SETTINGS.md](SECURITY_SETTINGS.md)).
- **Drei-Produkte-Split (Portal/Studio/Brain)** — abgeschlossen und überholt:
  `apps/brain` und `apps/family` laufen mit eigenen Datenbanken (physischer
  DB-Split, PR #783; Family in Abspeckung N.3, PR #811). Die frühere
  Foundation-Doku unter `docs/rework/` wurde entfernt; aktuelle Wahrheit:
  [engineering/domain-contracts.md](engineering/domain-contracts.md) und
  [engineering/access-model.md](engineering/access-model.md).
