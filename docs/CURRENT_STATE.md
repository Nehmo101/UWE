# UWE — Current State

Kurze, eindeutige Wahrheit über den aktiven Stand. Bei Widersprüchen in anderen
Dokumenten gilt diese Datei (Runtime/CI) bzw.
[FEATURE_MATURITY_MATRIX.md](FEATURE_MATURITY_MATRIX.md) (Feature-Reifegrade).

Stand: 2026-07-06 (Doku-Sync nach Roadmap-Welle PR #498).

## Aktive Runtime

- **UWE Host** — Linux + Node.js 22 + `pnpm` + `systemd` (`deploy/systemd/uwe.service`,
  `deploy/scripts/setup-uwe-host.sh`). Hier laufen Studio, Portal und die persistente DB.
- **RTX Host Connector** — optionaler **outbound** Worker (`tools/uwe-rtx-connector`,
  `pnpm connector:start`). Öffnet keinen Port am RTX-PC, verbindet sich ausschließlich
  ausgehend zum Host. Siehe [rtx-connector.md](rtx-connector.md).
- **Cloudflare Tunnel / Access** — optional davor; nur Studio/Portal, niemals RTX/Ollama.
- **Datenbank** — SQLite (Default) oder optional PostgreSQL (`schema.postgresql.prisma`).

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

- `apps/studio` — DM-App (Port 3000): Weltbearbeitung, Admin, KI, Daily Admin OS.
- `apps/portal` — Spieler-Wiki (Port 3001): nur gefilterte, freigegebene Inhalte.

## Aktive Packages

`@uwe/database`, `@uwe/auth`, `@uwe/security`, `@uwe/ai-brain`, `@uwe/assets`,
`@uwe/shared-ui`, `@uwe/shared-utils`, `@uwe/config`, `@uwe/env`, `@uwe/connector`,
`@uwe/static-export`, sowie Feature-Packages: `@uwe/backup`, `@uwe/calendar`,
`@uwe/mail`, `@uwe/dnd-api`, `@uwe/image-studio`, `@uwe/agent-jobs`,
`@uwe/knoteforge-import`, `@uwe/soundboard`, `@uwe/cookbook`, `@uwe/web-search`,
`@uwe/security-tests`. Aktives Tool: `tools/uwe-rtx-connector` (`@uwe/rtx-connector`).

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

Offene Rest-Punkte (Details: [FEATURE_BACKLOG_PLAN.md](FEATURE_BACKLOG_PLAN.md) §2–§5):

- **NL-Kommandos:** LLM-Intent-Parsing (bewusst nicht verfolgt); optionale Template-Auswahl bei `create_world`.
- **Import-Zentrale:** Obsidian-/PDF-Upload-UI (bewusst nicht verfolgt laut Produkt).
- **Tags:** Auf Produktions-Hosts nach `pnpm verify:tag-backfill` ggf. `UWE_ENTITY_TAGS_PRIMARY=true` setzen (Json-Dual-Write bei Merges aus).

Zuletzt umgesetzt (Roadmap-Welle PR #498+): NL `list_world_members`, `delete_user`, `reset_password`;
Today-Widget „Projekte nach Domäne“; Projekt-Detail mit Domänen-Modul-Links; EntityTag-Primary-Mode für Tag-Merges;
Mail-Entwürfe, Kalender-Grid, Ideas-Prompt-CRUD, Atlas-Handout, Zaubergrad-Import, Weltuhr/Chronik-Nav.

**Nicht im Backlog** (bewusst nicht verfolgt): Asset-Level-Secrets, manuelle Browser-QA
über 9 Theme-Presets, vollständiges Light-Theme-Refactoring, DB↔Client-Theme-Sync,
`docs:check` für Skills-README, DnD-API-Cache-Aufräumen, Agent-Jobs-Completion-Callback;
per Beschluss (FEATURE_BACKLOG_PLAN.md §13): KI-Capture-Sortierung (LLM-Ausbau),
voller Secret-Vault, semantische Suche (Embeddings).

## Weitere bekannte Lücken (ohne festen Backlog-Slot)

- **Life-Brain Retrieval** — implementiert (Beta): RTX-Embeddings + Keyword-Fallback
  (`/api/life-brain/search`, Such-/Index-Panels + Reindex auf `/life-brain`); kein
  Cloud-Fallback, Qualität RTX-abhängig.
- **Performance** — keine Browser-LCP-Gates, nur CI-Smoke + Bundle-Budget.
- **Capture Bild-Upload** — implementiert (`/api/capture/upload`, Quick Capture); UI auf `/capture`.
- **Agent Jobs** — Dispatch + Polling funktional; kein Auto-Merge (by design, siehe [SECURITY_SETTINGS.md](SECURITY_SETTINGS.md)).
