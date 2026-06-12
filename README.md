# UWE — Universeller Welten-Editor

**UWE** is a self-hosted campaign brain and world wiki for D&D and tabletop RPGs.

| Component | Name | Purpose |
|-----------|------|---------|
| Product | **UWE** | Overall platform |
| DM App | **UWE Studio** | World and campaign editor (DM-only knowledge) |
| Player App | **UWE Portal** | Player-facing wiki and handouts (live web app + API) |
| Export | **Static Export** | Player-safe HTML export for simple hosting |
| Backend | **UWE Core** | Shared data layer, auth, wiki engine (packages) |

> Self-hosted campaign brain and world wiki — no cloud required.

---

## Quick start (Docker — empfohlen)

Der einfachste Weg: Docker installieren, Repository klonen, `.env` anlegen, starten.

```bash
git clone https://github.com/nehmo101/uwe
cd uwe
cp .env.example .env
docker compose up -d
```

Beim **ersten Start** baut Docker die Images (kann einige Minuten dauern). Anschließend:

| App | URL | Zweck |
|-----|-----|-------|
| **UWE Studio** (DM) | http://localhost:3000 | Welten bearbeiten |
| **UWE Portal** (Spieler) | http://localhost:3001 | Wiki & Handouts |

**Demo-Login** (automatisch beim ersten Start): `dm@uwe.local` / `uwe-dev`  
Weitere Demo-Spieler: siehe Container-Logs nach dem Seed (`docker compose logs studio`).

Status prüfen:

```bash
docker compose ps
curl http://localhost:3000/api/health
curl http://localhost:3001/api/health
```

**Produktion:** `AUTH_SECRET` in `.env` setzen und `RUN_DB_SEED=false` — Details in [docs/PRODUCTION.md](docs/PRODUCTION.md).

Persistente Daten:

| Pfad / Volume | Inhalt |
|---------------|--------|
| Docker-Volume `uwe-database` | SQLite-Datenbank |
| `./data/uploads` | Hochgeladene Assets |
| `./data/backups` | Backup-Ordner |
| `./exports` | Statische HTML-Exporte |

---

## Alternative: Lokale Entwicklung (ohne Docker)

### Prerequisites

- **Node.js** ≥ 20
- **pnpm** ≥ 10 (`corepack enable && corepack prepare pnpm@latest --activate`)

### Install and run

```bash
pnpm install
cp .env.example .env
pnpm --filter @uwe/database db:migrate
pnpm --filter @uwe/database db:seed
pnpm dev
```

Or individually:

```bash
pnpm dev:studio   # http://localhost:3000
pnpm dev:portal   # http://localhost:3001
```

### Build and test

```bash
pnpm build:release   # production build (includes Prisma generate)
pnpm test
pnpm typecheck
pnpm lint            # ESLint (flat config at eslint.config.mjs, zero warnings allowed)
pnpm release:check   # validate release files and version sync
```

Linting uses a single flat ESLint config at the repo root (`eslint.config.mjs`) with
`eslint-config-next` (core-web-vitals + TypeScript rules) for both apps and all
shared packages. Run `pnpm lint` from the repo root; there are no per-package lint
scripts.

Current version: **0.1.0** (see `VERSION` and [CHANGELOG.md](CHANGELOG.md)).

---

## DM Workflow Highlights (Studio)

- **World Overview** — `/worlds/[slug]/dashboard` is the per-world start page: stats, next session, open plots, recently edited pages, player-note review queue, portal status, and quick-create shortcuts.
- **Command Palette** — press `Ctrl/⌘ + K` anywhere in Studio to jump to any view, quick-create entities, switch worlds, or search pages live.
- **Quick Create with templates** — the new-page form offers templates (NPC, Ort, Fraktion, Quest, Session-Plan, Handout) that pre-fill player-visible content plus DM-only note blocks. Slugs are optional and generated automatically. Templates are DB-backed and user-editable at `/templates` (create, edit, duplicate, deactivate); the built-in set is seeded once as system templates.
- **World Inspector with fix actions** — `/worlds/[slug]/inspector` audits what players can actually see: portal-visible pages/blocks/assets, share links (password/expiry), safety findings (e.g. player-visible GM notes), and canon warnings (broken wiki links, duplicate names, contradictions, orphan pages, unassigned pages). Findings link directly to the affected page/block and offer one-click fixes (e.g. set block to DM-only, convert broken wikilinks to text) — every fix is logged and undoable.
- **Activity Log & Next Actions** — the Studio dashboard shows an audit log (content/visibility changes, inspector fixes, template usage, imports/exports, backups, errors) with links to affected objects and inline undo, plus a "Next Actions" section (open findings, backup age, unassigned content, publicly visible player content, seed/migration problems).
- **Label-Druck** — `/worlds/[slug]/labels`: visueller 6×4-Zoll-Editor, Templates, Drucklisten, PDF/HTML-Export, DM/Player-Sicherheit. Details: [docs/LABELS.md](docs/LABELS.md).

---

## Player Portal (live)

The **UWE Portal** is a Next.js web app with backend/API:

- Public wiki at `/worlds/[worldSlug]/…`
- Player login at `/login` and authenticated views at `/auth/worlds/…`
- Health check: `GET /api/health` (includes database check)
- Auth API: `POST /api/auth/login`, `/logout`, `/preview`

Only **published** pages with visibility `public` or `player_visible` appear in the public wiki. DM-only blocks and pages are filtered server-side.

**Naming note:** because these routes need no login, Studio labels `player_visible` as **"Portal (ohne Login)"** — anything published with this visibility is readable by everyone who can reach the Portal. `dm_only` content is never served on `/worlds/*`; this is enforced by hard security tests (`packages/database/src/visibility-security.test.ts`).

---

## Soundboard (Studio)

UWE Studio includes a per-world/campaign **Soundboard** at `/worlds/[worldSlug]/soundboard`:

- **Local audio** via the asset library (`AssetType.audio`)
- **YouTube links** stored as URLs (embedded playback in Studio)
- **Spotify links** stored and prepared for future playback

**Spotify note:** Full Spotify playback control requires **Spotify Premium** and the **Spotify Web API** (OAuth + `PUT /v1/me/player/play`). OAuth is intentionally not implemented yet; see `packages/soundboard/src/spotify.ts` for the prepared adapter.

DM-only soundboard buttons are filtered for the Player Portal via the same visibility rules as assets.

---

## Static Export

Export a world as static HTML for hosting on webspace, NAS, GitHub Pages, or any static file server.

```bash
pnpm export:static --world terra
```

Output example:

```
exports/terra-static/
  index.html
  locations/arbor/index.html
  locations/validori/index.html
  factions/nepurga/index.html
  assets/portal.css
  assets/search.js
  search-index.json
```

Features:

- Exports one world at a time
- Only portal-visible, published content
- Internal wikilinks rewritten to relative paths
- Bundled CSS/JS and client-side search index
- Security audit: no DM-only titles, blocks, or secret JSON fields

From Studio (API):

```bash
curl -X POST http://localhost:3000/api/export/static \
  -H 'Content-Type: application/json' \
  -d '{"worldSlug":"terra"}'
```

Host the export folder with any static web server, for example:

```bash
npx serve exports/terra-static
```

---

## Roadmap (Auszug)

Erledigt:

- [x] Docker Compose für Studio + Portal + persistente Datenbank
- [x] Static HTML Export für player-sichere Wiki-Seiten
- [x] KnoteForge-Import (JSON) mit Preview, Mapping und Duplikaterkennung
- [x] Session Management für Welten und Kampagnen
- [x] Soundboard (lokale Sounds, YouTube, Spotify vorbereitet)

Geplant:

- [ ] Markdown/HTML als zusätzliche Export-Formate
- [ ] Asset-Datei-Import (Karten, Sounds, Handouts)
- [ ] PostgreSQL-Option für Self-Hosting

---

## Architecture

UWE is a **pnpm monorepo** with **Turborepo**:

```
apps/
  studio/          # UWE Studio — DM editor (port 3000)
  portal/          # UWE Portal — player wiki (port 3001)

packages/
  config/          # Shared TypeScript configs
  shared-ui/       # Shared React components
  database/        # Prisma schema, repository, page rendering
  static-export/   # Static HTML export generator
  wiki-engine/     # Wikilink parsing
  auth/            # Roles and permissions
  assets/          # Asset upload paths and MIME helpers
  soundboard/      # Active sound state + Spotify adapter (OAuth later)
  ai-brain/        # Local AI integration (Studio)
```

Stack: Next.js 15, React 19, TypeScript, Prisma 7, SQLite (libsql).

---

## Environment

Copy `.env.example` to `.env`. Important variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | SQLite path (`file:./data/uwe.db` in dev) |
| `UPLOADS_DIR` | Persistent uploads |
| `EXPORTS_DIR` | Static export output (Studio API) |
| `BACKUPS_DIR` | Backup folder |
| `AUTH_SECRET` | Reserved secret for future signed cookies (set in production) |
| `STUDIO_API_TOKEN` | Optional bearer token guarding sensitive Studio APIs |
| `RUN_DB_SEED` | Demo seed: `auto` (first empty DB), `true`, or `false` (production) |

---

## License

Private project — all rights reserved.

## Release

| Document | Purpose |
|----------|---------|
| [CHANGELOG.md](CHANGELOG.md) | Release notes |
| [docs/PRODUCTION.md](docs/PRODUCTION.md) | Production deployment, updates, backup |
| [SECURITY.md](SECURITY.md) | Security policy and checklist |
| [VERSION](VERSION) | Current product version |
