# Changelog

All notable changes to **UWE (Universeller Welten-Editor)** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

> **Stand-Hinweis (2026-07-28):** Dieser Abschnitt sammelt seit Juni; einzelne
> ältere Einträge unten (Docker Compose, Docker-Pre-Migration-Backup) beschreiben
> seither wieder entfernte Infrastruktur — siehe `docs/removed-legacy-runtime.md`.
> Die großen Juli-Umbauten in Kürze: Häkchen-Zugangsmodell statt Rollen-Enum,
> neue Apps `brain`/`family`/`landing`, physischer DB-Split
> (`uwe.db`/`uwe-brain.db`/`uwe-family.db`), Terra-Karteneditor (Atlas/Atlas-3D
> vollständig entfernt), Passkeys + Google-Login, Mail-Center nach Brain.

### Changed

- **RTX-Namen vollständig entfernt (Breaking)** — „RTX“ ist eine NVIDIA-Produktlinie; UWE hat nie eine vorausgesetzt, und OCR, Audio, Spotify, Diktat und Etikettendruck brauchen überhaupt keine GPU. Der Name ist jetzt aus Oberfläche, Bezeichnern, Pfaden, Env-Vars und DB-Enums verschwunden. Vokabular: **Maschinenraum** (Produktname) und `engine…` / `ENGINE_…` (Code). Umbenannt: `tools/uwe-rtx-connector` → `tools/uwe-engine-connector`, `apps/rtx-connector-client` → `apps/engine-connector-client`, `uwe-rtx-connector.service` → `uwe-engine-connector.service`, alle `RTX_*`-Env-Vars → `ENGINE_*` (**ohne Fallback**), `/soundboard/rtx` → `/soundboard/engine`, `ConnectorType.rtx_connector` → `engine_connector`, `ScanDocumentStatus.waiting_for_rtx` → `waiting_for_engine`. Migrationen schreiben Bestandsdaten inkl. KI-Nutzungslogs um; das Command Center übernimmt sein Datenverzeichnis und räumt alte Autostart-Einträge selbst auf, das Host-Setup-Skript Unit, State-Ordner und Connector-`.env`. `UWE_CONNECTOR_*`, `UWE_HOST_URL` und das Token-Präfix `uwec_` bleiben unverändert — Tokens müssen nicht neu ausgestellt werden. Checkliste: `docs/engineering/engine-rename-migration.md`. Historische Einträge weiter unten in dieser Datei nennen die alten Namen bewusst nicht mehr, damit kein Leser auf NVIDIA-only schließt
- **Drei Regexes gegen ReDoS gehärtet** — `stripCodeFence` (`@uwe/ai-brain`, Modell-Antworten), `REPLY_PREFIX` (`@uwe/mail-core`, Mail-Betreffzeilen) und der Zeilen-Parser der Feature-Matrix (`@uwe/database`) stellten je zwei Quantoren über derselben Zeichenmenge nebeneinander. Der Backtracker probierte dann jeden Aufteilungspunkt durch: gemessen quadratisch bei den ersten beiden, kubisch beim dritten (ab ~800 Zeichen über eine Sekunde). Die Betreffzeile ist der exponierteste Fall — sie kommt von jedem, der eine Mail an das Konto schicken kann, und die Regex läuft dort in einer Schleife. Fix ist in allen drei Fällen die Beseitigung der Mehrdeutigkeit, nicht eine Längenbegrenzung; die Feature-Matrix-Zeile wird jetzt an `|` aufgeteilt statt gematcht. Tests mit Laufzeitschranke liegen bei und schlagen ohne den Fix fehl

### Added

- **UWE Windows Releases** — GitHub Actions workflow publishes Command Center NSIS/MSI under tag `uwe-vX.Y.Z`; Command Center **Update** button syncs the checkout to the release, rebuilds Studio/Portal, and opens the Windows installer when the desktop app is behind
- **Release über Release-Tags** — den Tag `uwe-vX.Y.Z` erzeugt weiterhin die Pipeline; zusätzlich baut der Workflow jetzt auch aus einem **gepushten** `uwe-v*`-Tag und prüft dabei Tag gegen `VERSION`. `pnpm release:version X.Y.Z --pr` (`scripts/set-release-version.mjs`) schneidet den Versions-PR in einem Befehl: fünf Fassungsangaben inkl. `src-tauri/Cargo.toml`, `[Unreleased]` → `[X.Y.Z] - <heute>` nach Keep a Changelog, Branch `release/vX.Y.Z` und Commit — ohne Push und ohne den CHANGELOG-Text zu erfinden. Ohne `--pr` schreibt es nur die fünf Dateien; genau so ruft es der Release-Build auf, damit Build und PR nicht auseinanderlaufen. `pnpm release:version --check` findet Drift
- **Update-Check der Bundle-Installation** — „Nach Updates suchen“ liest in einer Installation ohne git das Release-Manifest `uwe-release.json` statt lokaler git-Tags (vorher schlug der Check dort mit einem git-Fehler fehl); der Update-Lauf öffnet den Command-Center-Installer auch dann, wenn nur die Desktop-App hinter dem Release-Tag liegt. Der Installer-Name kommt aus dem Manifest — keine `gh`-CLI und kein Token auf dem Zielrechner
- **UWE Daily Admin OS** — private admin cockpit: `/today`, `/capture`, `/projects`, `/workshop`, `/contracts`, `/hardware`, `/life-brain`
- **Studio Security Step 1** — URL classification, Maschinenraum exposure assessment, admin status cards
- **Life Admin data models** — Capture, PersonalProject, WorkshopProject, ContractExpense, HardwareDevice, PersonalBrain, Generator presets/outputs
- **Mobile bottom nav** — Heute, Capture, Suche, KI, Mehr + global Capture FAB
- **Personal Brain privacy** — `personal_brain` context mode, local-only, Maschinenraum offline job queue
- **Contextual Generator panel** — page edit KI actions with review flow and Maschinenraum-deferred jobs
- **Favorite world setting** — `app.favoriteWorldSlug` for /today without hardcoding Terra
- Docs: `docs/daily-admin-os.md`, `docs/life-brain-privacy.md`

- **World Overview Dashboard** — per-world start page (`/worlds/[slug]/dashboard`) with stats, next session, open plots, recently edited pages, player-note review queue, portal status, and quick-create actions
- **Command Palette** — global `Ctrl/⌘ + K` palette in Studio with navigation commands, quick-create actions, world switching, and live page search (`GET /api/command/search`)
- **Quick Create with page templates** — template picker for NPC, Ort, Fraktion, Quest, Session-Plan, and Handout on the new-page form; templates pre-fill player-visible content plus DM-only note blocks; slugs are now optional and auto-generated (umlaut-aware, collision-safe)
- **World Inspector** — read-only audit view (`/worlds/[slug]/inspector`) showing exactly which pages, blocks, and assets are portal-visible, all share links with password/expiry status, plus safety findings (player-visible GM notes, exposed secret pages, unprotected share links) and canon warnings (broken wiki links, ambiguous duplicate names, contradictory pages, orphan pages, inconsistent publish states)
- **Inspector fix actions** — findings now link directly to the affected page/block and offer one-click fixes (set block/page to DM-only, publish, convert broken wikilinks to plain text, assign uncategorized pages to the world's campaign); every fix snapshots the previous state and is undoable
- **Activity Log (audit log)** — records content created/changed/deleted, visibility changes, inspector fixes, template lifecycle/usage, imports/exports, backups/restores, seeds, and relevant errors; shown on the Studio dashboard with links to the affected objects and inline undo buttons
- **Undo basis (soft delete light)** — destructive and automatic changes (inspector fixes, content block deletions) store a JSON snapshot (`undo_entries`) and can be restored from the activity log
- **DB-backed page templates** — Quick-Create templates moved from code to the database (`page_templates`); previous templates are seeded once as system templates; users can create, edit, duplicate, and deactivate templates at `/templates`; legacy `?template=npc` links keep working
- **Seed tracking** — `seed_history` table records applied data seeds (idempotent across restarts); seed/migration problems surface in the dashboard and healthcheck
- **Next Actions on the dashboard** — open inspector findings, missing/stale backups, unassigned content, publicly visible player content, pending template seed, and migration problems at a glance
- **Extended healthchecks** — `GET /api/health` (Studio + Portal) now reports migrations state, storage writability, seed status, app version/commit, trust/exposure mode, and rate limiter mode — without leaking sensitive data
- **Pre-migration DB backup (Docker)** — the entrypoint copies the SQLite file to `data/backups/pre-migration-<timestamp>.db` before applying pending migrations
- **ESLint flat config** — real `eslint-config-next` setup for the whole monorepo (`pnpm lint`), placeholder lint scripts removed

### Changed

- **Dienste enden mit dem Command Center** — Beenden der App (Dialog *und* Tray-„Beenden") stoppt Studio, Portal, Brain, Familie, Startseite und trennt den Cloudflare-Tunnel; die öffentliche Seite bleibt nicht länger ohne laufende Steuerungs-App erreichbar. Neue Einstellung `stopServicesOnExit` (Standard **an**, auch für bestehende Konfigurationsdateien) macht das alte Verhalten bewusst wählbar. Als Absicherung gegen Absturz und `taskkill` hängen alle Kindprozesse in einem Windows Job Object mit `KILL_ON_JOB_CLOSE`; „Im Browser öffnen" bricht per `CREATE_BREAKAWAY_FROM_JOB` daraus aus. „Alles stoppen" schließt jetzt den Tunnel mit ein
- **Visibility labels sharpened** — `player_visible` is now labeled "Portal (ohne Login)" and `public` "Öffentlich (Share-Link)" across Studio; badges carry explanatory tooltips and the page editors show a hint that these contents are readable on `/worlds/*` without login once published (internal enum semantics unchanged)

### Removed

- **Cursor Agent Jobs** — UWE verschickt keine Entwicklungs-Prompts mehr an GitHub Actions, an die Cursor-Cloud-Agents-API oder an die lokale Cursor-CLI. Weg sind `/admin/agent-jobs`, `/api/agent-jobs/*`, der Callback-Endpunkt, `@uwe/agent-jobs`, der Workflow `cursor-agent.yml`, der Job-Typ `agent_job` und das Modell `DevAgentJob`. Entwicklung läuft über GitHub, nicht über UWE. **ENV, die entfällt:** `AGENT_JOBS_*`, `CURSOR_CLOUD_API_KEY`, `CURSOR_API_KEY`
- **„An Cursor übergeben" im Ideen-Management** — Ideen, KI-Chat, erzeugter Prompt und die Claude-Übergabe bleiben unverändert; nur der Absende-Knopf und das Cursor-Statuspanel sind weg, der Prompt wird kopiert statt abgeschickt

### Changed (Bug-Center)

- **GitHub-Issues aus Bug-Reports** bleiben erhalten, hängen aber nicht mehr an der Agent-Jobs-Konfiguration: neues Paket `@uwe/github-issues`, neue ENV `GITHUB_ISSUE_REPO` und `GITHUB_TOKEN` / `GITHUB_ISSUE_TOKEN` statt `AGENT_JOBS_GITHUB_REPO` / `AGENT_JOBS_GITHUB_TOKEN`. **Wer die Funktion nutzt, muss die beiden Werte umbenennen** — sonst meldet der Knopf „nicht konfiguriert"

## [0.1.0] - 2026-06-11

First usable self-hosted release of UWE.

### Added

- **UWE Studio** — DM campaign editor with world, page, and asset management
- **UWE Portal** — player-facing wiki with authentication and published content filtering
- **Static HTML export** — player-safe offline wiki hosting
- **Docker Compose** — production-ready stack for Studio + Portal with health checks
- **SQLite database** with Prisma migrations and automatic deploy on container start
- **Auth & roles** — DM and player accounts with world memberships
- **Asset library** — uploads for maps, handouts, audio, and images
- **Soundboard** — local audio, YouTube links, Spotify adapter (OAuth prepared)
- **Game sessions** — session management for campaigns
- **Dungeon cockpit** — room prep workflow for dungeon crawls
- **KnoteForge import** — JSON import with preview and duplicate detection
- **Backup & restore** — full instance and world-level backups
- **Share links** — public sharing for pages, handouts, and assets
- **Player notes** — player comments and DM review workflow
- **Labels & printing** — label templates and PDF export
- **Global search** — DM and portal search indexes
- **Link graph** — visual page relationship explorer
- **AI Brain (Studio)** — optional local-first AI assistant with privacy controls
- **Admin settings** — central system configuration
- Health endpoints: `GET /api/health` on Studio (port 3000) and Portal (port 3001)
- Production documentation in `docs/PRODUCTION.md`

### Security

- `.env` is gitignored; use `.env.example` as template
- Set a strong `AUTH_SECRET` before production deployment
- DM-only content is filtered server-side in the Portal

[0.1.0]: https://github.com/uwe/uwe/releases/tag/v0.1.0
