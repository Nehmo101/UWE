# Changelog

All notable changes to **UWE (Universeller Welten-Editor)** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **UWE Windows Releases** — GitHub Actions workflow publishes Command Center NSIS/MSI under tag `uwe-vX.Y.Z`; Command Center **Update** button syncs the checkout to the release, rebuilds Studio/Portal, and opens the Windows installer when the desktop app is behind
- **UWE Daily Admin OS** — private admin cockpit: `/today`, `/capture`, `/projects`, `/workshop`, `/contracts`, `/hardware`, `/life-brain`
- **Studio Security Step 1** — URL classification, RTX exposure assessment, admin status cards
- **Life Admin data models** — Capture, PersonalProject, WorkshopProject, ContractExpense, HardwareDevice, PersonalBrain, Generator presets/outputs
- **Mobile bottom nav** — Heute, Capture, Suche, KI, Mehr + global Capture FAB
- **Personal Brain privacy** — `personal_brain` context mode, local-only, RTX offline job queue
- **Contextual Generator panel** — page edit KI actions with review flow and RTX-deferred jobs
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

- **Visibility labels sharpened** — `player_visible` is now labeled "Portal (ohne Login)" and `public` "Öffentlich (Share-Link)" across Studio; badges carry explanatory tooltips and the page editors show a hint that these contents are readable on `/worlds/*` without login once published (internal enum semantics unchanged)

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
