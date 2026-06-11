# UWE — Universeller Welten-Editor

**UWE** is a self-hosted campaign brain and world wiki for D&D and tabletop RPGs.

| Component | Name | Purpose |
|-----------|------|---------|
| Product | **UWE** | Overall platform |
| DM App | **UWE Studio** | World and campaign editor (DM-only knowledge) |
| Player App | **UWE Portal** | Player-facing wiki and handouts |
| Backend | **UWE Core** | Shared data layer, auth, wiki engine (packages) |

> Self-hosted campaign brain and world wiki — no cloud required.

---

## Architecture

UWE is built as a **pnpm monorepo** with **Turborepo** for task orchestration.

### Why this stack?

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Monorepo | pnpm workspaces + Turborepo | Clean separation of Studio, Portal, and Core packages with shared tooling |
| Apps | Next.js 15 (App Router) | Modern React, SSR-ready, self-hostable, Docker-friendly |
| Language | TypeScript | Type safety across apps and packages |
| Database (planned) | Prisma + SQLite/PostgreSQL | Local-first with optional self-hosted Postgres |
| Auth (planned) | Package stub → session-based | DM vs. player role separation |

### Repository structure

```
apps/
  studio/          # UWE Studio — DM campaign editor (port 3000)
  portal/          # UWE Portal — player wiki (port 3001)

packages/
  config/          # Shared TypeScript configs
  shared-ui/       # Shared React components
  database/        # UWE Core — database layer (Phase 2)
  wiki-engine/     # Wikilinks, backlinks (Phase 3)
  auth/            # Authentication (Phase 4)
  assets/          # Maps, handouts, sounds (future)
  ai-brain/        # Local AI integration (future)
```

This matches the proposed monorepo layout. Studio and Portal stay independent deployable apps; Core logic lives in shared packages consumed by both.

**UWE is fully independent from KnoteForge Local.** No code, config, or data is shared with the existing KnoteForge repository.

---

## Prerequisites

- **Node.js** ≥ 20
- **pnpm** ≥ 10 (`corepack enable && corepack prepare pnpm@latest --activate`)

---

## Local development

### 1. Install dependencies

```bash
pnpm install
```

### 2. Environment (optional)

```bash
cp .env.example .env
```

Adjust ports or URLs if needed. Defaults work out of the box.

### 3. Start both apps

```bash
pnpm dev
```

Or individually:

```bash
pnpm dev:studio   # http://localhost:3000
pnpm dev:portal   # http://localhost:3001
```

### 4. Health checks

- Studio: [http://localhost:3000/api/health](http://localhost:3000/api/health)
- Portal: [http://localhost:3001/api/health](http://localhost:3001/api/health)

### 5. Build and test

```bash
pnpm build
pnpm test
pnpm typecheck
```

---

## Roadmap

### Phase 1 — Foundation (current)

- [x] Monorepo structure
- [x] UWE Studio and Portal start pages
- [x] Shared UI and config packages
- [x] Health check endpoints
- [x] Minimal tests

### Phase 2 — UWE Core database

- [ ] Prisma schema for worlds, campaigns, entities
- [ ] SQLite for local dev, PostgreSQL for self-host
- [ ] CRUD API layer in `@uwe/database`

### Phase 3 — Wiki engine

- [ ] `[[wikilink]]` parsing and rendering
- [ ] Backlinks and graph navigation
- [ ] Obsidian-style page editor in Studio

### Phase 4 — Auth and knowledge separation

- [ ] DM vs. player roles
- [ ] Player-safe content filtering for Portal
- [ ] Session and access tokens

### Phase 5 — Player portal

- [ ] Campaign selection and player login
- [ ] Handouts and session recaps
- [ ] Public wiki pages

### Phase 6 — Self-host and Docker

- [ ] Docker Compose for Studio + Portal + database
- [ ] Production build and deployment docs

### Phase 7 — AI brain

- [ ] Local Ollama integration
- [ ] Optional cloud API keys
- [ ] Campaign context for AI assistance

### Phase 8 — KnoteForge import

- [ ] One-way import from KnoteForge Local
- [ ] Migration mapping and validation

### Future

- Asset management (maps, sounds, handouts)
- Dungeon cockpit
- Soundboard integration

---

## License

Private project — all rights reserved.
