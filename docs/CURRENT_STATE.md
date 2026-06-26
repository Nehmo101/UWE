# UWE — Current State

Kurze, eindeutige Wahrheit über den aktiven Stand. Bei Widersprüchen in anderen
Dokumenten gilt diese Datei (Runtime/CI) bzw.
[FEATURE_MATURITY_MATRIX.md](FEATURE_MATURITY_MATRIX.md) (Feature-Reifegrade).

Stand: Juni 2026.

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
- `security.yml`, `docs-check.yml` (scheduled/Pfad-gefiltert), `deploy.yml` (SSH zum Host)

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
- **Beta:** Calendar, DnD API, Daily Admin OS, Secrets/Reveal, Kanonprüfung,
  Prepare-for-next-session.
- **Lab / nicht production-ready:** Image Studio, Agent Jobs / Orchestrator,
  Performance-Budget / große Testwelt, Import Undo (fehlt), Life-Brain Retrieval (fehlt).
- **Deprecated/Removed:** Docker, Windows-One-Click-Installer, inbound RTX-Agent.

## Bekannte nicht-production-ready Bereiche

- **Import Undo fehlt** — Imports sind nur per Backup zurückrollbar; UI warnt vor Execute.
- **Agent Jobs** — kein Completion-Callback/PR-Sync; Status bleibt ggf. `running`.
- **Image Studio** — kein Canvas-Editor; Cloud-Edit/Fehlerhandling unvollständig.
- **Life-Brain Retrieval** — kein Embedding/Retrieval; nur Speicherung.
- **Performance** — keine Browser-LCP-Gates, nur CI-Smoke + Bundle-Budget.
