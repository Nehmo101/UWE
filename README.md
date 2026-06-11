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

## Quick start (Docker)

```bash
cp .env.example .env
docker compose up -d
```

- **Studio (DM):** http://localhost:3000  
- **Portal (Spieler):** http://localhost:3001  

Optional demo data on first start:

```bash
RUN_DB_SEED=true docker compose up -d
```

Demo login (after seed): any seeded user with password `uwe-dev`.

Persistent data:

| Path | Purpose |
|------|---------|
| Docker volume `uwe-database` | SQLite database |
| `./data/uploads` | Uploaded assets |
| `./data/backups` | Backup folder |
| `./exports` | Static HTML exports |

---

## Local development

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
pnpm build
pnpm test
pnpm typecheck
```

---

## Player Portal (live)

The **UWE Portal** is a Next.js web app with backend/API:

- Public wiki at `/worlds/[worldSlug]/…`
- Player login at `/login` and authenticated views at `/auth/worlds/…`
- Health check: `GET /api/health` (includes database check)
- Auth API: `POST /api/auth/login`, `/logout`, `/preview`

Only **published** pages with visibility `public` or `player_visible` appear in the public wiki. DM-only blocks and pages are filtered server-side.

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
  assets/          # Asset helpers (future)
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
| `AUTH_SECRET` | Session secret (set in production) |
| `RUN_DB_SEED` | Seed demo world in Docker (`true`/`false`) |

---

## License

Private project — all rights reserved.
