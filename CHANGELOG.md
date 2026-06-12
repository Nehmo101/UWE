# Changelog

All notable changes to **UWE (Universeller Welten-Editor)** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **World Overview Dashboard** — per-world start page (`/worlds/[slug]/dashboard`) with stats, next session, open plots, recently edited pages, player-note review queue, portal status, and quick-create actions
- **Command Palette** — global `Ctrl/⌘ + K` palette in Studio with navigation commands, quick-create actions, world switching, and live page search (`GET /api/command/search`)
- **Quick Create with page templates** — template picker for NPC, Ort, Fraktion, Quest, Session-Plan, and Handout on the new-page form; templates pre-fill player-visible content plus DM-only note blocks; slugs are now optional and auto-generated (umlaut-aware, collision-safe)
- **World Inspector** — read-only audit view (`/worlds/[slug]/inspector`) showing exactly which pages, blocks, and assets are portal-visible, all share links with password/expiry status, plus safety findings (player-visible GM notes, exposed secret pages, unprotected share links) and canon warnings (broken wiki links, ambiguous duplicate names, contradictory pages, orphan pages, inconsistent publish states)

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
