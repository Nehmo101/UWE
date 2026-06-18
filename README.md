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

### Daily Admin OS

UWE ist ein **tägliches privates Admin-Cockpit** neben dem DnD-Editor: Heute-Dashboard, Capture-Inbox, Projekte, Werkstatt, Verträge, Hardware/Homelab und persönliches Life-Brain.

| Bereich | Status |
|---------|--------|
| DnD-Welten, Brain, KI-Router, Admin Status | ✅ done |
| Mobile Bottom Nav, KI-Prompt, Capture FAB | ✅ done |
| `/today`, `/capture`, `/projects`, `/workshop`, `/contracts`, `/hardware`, `/life-brain` | ✅ done (Basis-UI; Lücken: Kalender auf `/today`, Capture-Bild-Upload) |
| Life-Brain RTX-Offline-Queue, erweiterte Mobile-Views | 🔶 partial |

Details: [docs/daily-admin-os.md](docs/daily-admin-os.md) · Reifegrad: [docs/FEATURE_MATURITY_MATRIX.md](docs/FEATURE_MATURITY_MATRIX.md)

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

**Daily Admin OS** (Studio): `/today` — Cockpit für Capture, Projekte, Verträge, Hardware und persönliches Life-Brain. Siehe [docs/daily-admin-os.md](docs/daily-admin-os.md).

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

## Windows (ohne Docker)

Für Windows-Nutzer gibt es einen **One-Click-Installations-Assistenten** — ohne Terminal, Docker oder manuelle Konfiguration.

### One-Click Installation

1. Node.js 20+ installieren: https://nodejs.org/
2. **`UWE-Installieren.cmd`** doppelklicken oder:

```powershell
pnpm installer:windows
```

3. Im Assistenten **„Installieren & Starten“** wählen
4. UWE über die Desktop-Verknüpfung **„UWE starten“** öffnen

| Dokument | Inhalt |
|----------|--------|
| [docs/windows-install.md](docs/windows-install.md) | Schritt-für-Schritt für Endnutzer |
| [docs/windows-troubleshooting.md](docs/windows-troubleshooting.md) | Fehlerbehebung |
| [docs/backup-restore.md](docs/backup-restore.md) | Backup & Restore |
| [docs/WINDOWS_INSTALLER.md](docs/WINDOWS_INSTALLER.md) | Technische Details |

**Wartung:** Desktop-Verknüpfung **„UWE Steuerung“** — Start/Stop, Backup, Update, Reparatur, Deinstallation.

**Entwickler:** Der normale Workflow (`pnpm install`, `pnpm dev`, `pnpm build`) bleibt unverändert.

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
pnpm install --frozen-lockfile
pnpm ci:check           # fast gate: lint, typecheck, test:ci, build
pnpm quality            # full gate (same as CI) — run before PR
pnpm build:release      # production build (includes Prisma generate)
pnpm test
pnpm typecheck
pnpm lint               # ESLint (flat config at eslint.config.mjs, zero warnings allowed)
pnpm docs:check         # required docs + markdown sanity
pnpm release:check      # validate release files and version sync
```

Pull requests and pushes to `main` run CI in GitHub Actions (`.github/workflows/ci.yml` — full `pnpm quality`). Fast PR feedback: `pr-check.yml`. Security and docs: `security.yml`, `docs-check.yml`. See [docs/engineering/ci.md](docs/engineering/ci.md). Manual QA: [docs/TEST_PLAN.md](docs/TEST_PLAN.md), auth matrix: [docs/SECURITY_QA_MATRIX.md](docs/SECURITY_QA_MATRIX.md).

Linting uses a single flat ESLint config at the repo root (`eslint.config.mjs`) with
`eslint-config-next` (core-web-vitals + TypeScript rules) for both apps and all
shared packages. Run `pnpm lint` from the repo root; there are no per-package lint
scripts.

Current version: **0.1.0** (see `VERSION` and [CHANGELOG.md](CHANGELOG.md)).

---

## DM Workflow Highlights (Studio)

- **KI-gestützter DnD-Generator** — kontextuelle Aktionen (NPC, Ort, Dungeon-Raum, Encounter, Handout, Kanonprüfung, Session-Vorbereitung) über lokale RTX; Review/Apply-Workflow, keine automatische Kanonisierung. Details: [docs/dnd-generator-upgrade.md](docs/dnd-generator-upgrade.md).
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

Only **published** pages with visibility `public` or `player_visible` appear in the public wiki. DM-only blocks and pages are filtered server-side — this is enforced by hard security tests (`packages/database/src/visibility-security.test.ts`).

**What is safe to expose publicly**

| Surface | Public exposure |
|---------|-----------------|
| **Player Portal** (`/worlds/*`) | Published `player_visible` / `public` content only — no login required on these routes |
| **Authenticated Portal** (`/auth/worlds/*`) | Role-filtered player content; still no Spotify playback control |
| **Studio** | **Not safe on the public internet without layered protection** — Studio has session login (`/login`) and role gates, but assume DM-level access after login; use Cloudflare Access, VPN, or reverse-proxy auth in addition |

### Authentication & first-run setup

| Route | App | Purpose |
|-------|-----|---------|
| `/` | Portal | Landing page (links to demo wiki and login) |
| `/login` | Studio, Portal | Session login (email + password) |
| `/logout` | Studio | Clears session, redirects to `/login` |
| `/setup` | Studio | One-time owner bootstrap (requires `UWE_SETUP_TOKEN`) |
| `/forgot-password`, `/reset-password` | Studio, Portal | Self-service password reset |
| `/account/password` | Studio | Change password (logged-in) |
| `/auth/account/password` | Portal | Change password (logged-in) |

**First-run (production):** Set `UWE_SETUP_TOKEN` and `RUN_DB_SEED=false`, open Studio `/setup`, create the owner account. Setup is disabled automatically once an owner exists. See [docs/PRODUCTION.md](docs/PRODUCTION.md) and [docs/SECURITY_QA_MATRIX.md](docs/SECURITY_QA_MATRIX.md).

**Password reset:** Self-service via `/forgot-password` and `/reset-password` (both apps). Admins can also reset via Studio (`/api/admin/users/[id]/reset-password`). Details: [docs/auth-api-security.md](docs/auth-api-security.md).

**Roles:** `owner` / `admin` / `dm` → Studio; `player` → Portal only; `guest` / `readonly` → public wiki.

**Protected vs public routes:** Central policy in `@uwe/auth` (`route-policy.ts`). Security QA matrix: [docs/SECURITY_QA_MATRIX.md](docs/SECURITY_QA_MATRIX.md).

**Naming note:** because public routes need no login, Studio labels `player_visible` as **"Portal (ohne Login)"** — anything published with this visibility is readable by everyone who can reach the Portal. `dm_only` content is never served on `/worlds/*`.

---

## Soundboard (Studio)

UWE Studio includes a per-world/campaign **Soundboard** at `/worlds/[worldSlug]/soundboard`:

- **Local audio** via the asset library (`AssetType.audio`)
- **YouTube links** stored as URLs (embedded playback in Studio)
- **Spotify links** with OAuth per world and playback control via the **Spotify Web API** / **Spotify Connect** in Studio

### Spotify setup (Studio only)

Spotify playback is **Studio/DM-side only**. The Player Portal may show Spotify buttons and hints, but it does **not** trigger playback.

1. Create a Spotify app at [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Add the redirect URI to your app (must match exactly):
   ```
   http://localhost:3000/api/spotify/callback
   ```
3. Set these variables in `.env`:

   | Variable | Purpose |
   |----------|---------|
   | `SPOTIFY_CLIENT_ID` | OAuth client ID |
   | `SPOTIFY_CLIENT_SECRET` | OAuth client secret |
   | `SPOTIFY_REDIRECT_URI` | Callback URL (e.g. `http://localhost:3000/api/spotify/callback`) |
   | `AUTH_SECRET` | Encrypts stored Spotify tokens — **must stay stable** after connecting accounts |

4. In Studio, open the world soundboard and connect Spotify (one account per world).
5. **Spotify Premium** is required for playback-control endpoints (`/v1/me/player/*`).

Token storage is world-scoped and encrypted with `AUTH_SECRET`. Changing `AUTH_SECRET` after connecting Spotify invalidates stored tokens — reconnect in Studio if you rotate the secret.

DM-only soundboard buttons are filtered for the Player Portal via the same visibility rules as assets.

---

## KI-System (Brain & RTX)

UWE Studio bietet ein **lokales Brain** (DnD-/World-Wissen, Sessions, Kanon) und optional **Cloud-KI** nur für allgemeine Fragen ohne Kampagnendaten. Inferenz läuft bevorzugt über einen **RTX-Agent** im Heimnetz (Ollama/LM Studio auf dem RTX-Rechner).

| Rolle | Rechner | Aufgabe |
|-------|---------|---------|
| **UWE Host** | Alter Laptop / Self-Host | Datenbank, Brain, Mail, Studio — **alle persistenten Daten** |
| **RTX-Agent** | RTX-PC (Heimnetz) | Nur Inferenz-Worker — **speichert keine UWE-Daten** |
| **Cloud-KI** | Externer Anbieter | Nur allgemeiner Chat — **kein Brain/Weltwissen** |

Details zur Sicherheit: [SECURITY_NOTES.md](SECURITY_NOTES.md) · Deployment: [docs/ai-brain-mail/ENV_AND_DEPLOYMENT.md](docs/ai-brain-mail/ENV_AND_DEPLOYMENT.md)

### KI-Modi

Wähle im Admin-Portal (Desktop oder mobil), **welcher Provider** die Anfrage ausführt:

| Modus | Verhalten |
|-------|-----------|
| **Auto** | Bevorzugt lokale RTX-KI. Bei **Allgemeinem Chat** und offline RTX: Fallback auf Cloud (wenn konfiguriert). Bei Brain oder aktuellem Objekt: **blockieren**, wenn RTX nicht bereit — **kein Cloud-Fallback**. |
| **Lokale KI / RTX** | Nur der RTX-Agent. Brain-, Objekt- und Weltkontext erlaubt, wenn RTX **ready** ist. RTX offline/deaktiviert → Anfrage wird abgelehnt. |
| **Cloud-KI** | Nur **Allgemeiner Chat**. Kein Brain, kein aktuelles Objekt, keine UWE-Weltdaten. |

### Kontextmodi

Zusätzlich zum KI-Modus wählst du, **welcher Kontext** an die KI geht:

| Kontext | Inhalt | Cloud erlaubt? |
|---------|--------|----------------|
| **Allgemeiner Chat** | Nur dein Prompt — keine UWE-Objekte, kein Brain | Ja |
| **DnD-/World-Wissen** | Brain-Retrieval, Wissenstexte, Kanon | Nein — nur lokale RTX |
| **Aktuelles Objekt** | Die gerade geöffnete Seite/Entität | Nein — nur lokale RTX |
| **Aktuelles Objekt + DnD-/World-Wissen** | Objekt plus Brain-Kontext | Nein — nur lokale RTX |

### Datenschutzregel

Diese Regel ist **nicht verhandelbar** und wird serverseitig durchgesetzt:

- **Brain bleibt lokal** — Wissen, Embeddings und Retrieval liegen in UWE auf dem Host-Rechner.
- **Cloud-KI nutzt nur Allgemeinen Chat** — kein Brain, kein aktuelles Objekt, keine Sessions, NPCs, Orte oder Kanon.
- **Cloud-KI erhält kein Brain/Weltwissen** — auch nicht „aus Versehen“ über Auto oder UI.
- **Brain-Prompts funktionieren nur mit lokaler KI** — Kontextmodi mit Brain oder Objekt erfordern RTX **ready**.
- **Auto fällt bei Brain nicht auf Cloud zurück** — RTX offline → blockieren mit klarer Fehlermeldung, nicht an Cloud senden.

In der UI siehst du Hinweise wie: *„Cloud-KI erhält keinen Zugriff auf lokales Brain/Weltwissen.“*

### RTX-Agent einrichten

Der **UWE RTX-Agent** läuft auf dem RTX-Rechner als lokaler Dienst (optional mit Windows-Tray und Autostart). UWE spricht nur mit dem Agenten — nicht direkt mit dem Internet.

#### 1. RTX-Agent starten

Auf dem RTX-PC das Teilprojekt `uwe-rtx-agent` starten (Konsole oder Tray-App). Standard: lauscht im Heimnetz auf einer privaten IP (z. B. `http://192.168.x.x:8787`).

#### 2. Token setzen

Im Agent und in UWE **dasselbe** Shared Secret verwenden:

```env
# RTX-Agent (.env auf dem RTX-PC)
AGENT_TOKEN=generiere-ein-langes-zufaelliges-geheimnis

# UWE Host (.env auf dem Laptop)
RTX_AGENT_TOKEN=dasselbe-geheimnis-wie-oben
```

Token nur serverseitig — **nie** im Browser oder in Git committen.

#### 3. URL konfigurieren

In der UWE-`.env` auf dem Host:

```env
RTX_AGENT_URL=http://192.168.x.x:8787
```

Nur Heimnetz-IP oder `localhost` — **keine** öffentliche URL, kein Cloudflare-Tunnel zum RTX.

#### 4. Ollama/Backend konfigurieren

Auf dem RTX-PC im Agent (Beispiel Ollama):

```env
OLLAMA_BASE_URL=http://127.0.0.1:11434
DEFAULT_MODEL=qwen2.5-coder:7b
```

Alternativ LM Studio / OpenAI-kompatibel — siehe Agent-README. Optional: `START_OLLAMA_COMMAND`, wenn der Agent Ollama mitstarten soll.

In UWE optional:

```env
PREFERRED_LOCAL_MODEL=qwen2.5-coder:7b
```

#### 5. Autostart aktivieren

In der Windows-Tray-App: **„Beim Windows-Start ausführen“** aktivieren (CurrentUser-Autostart, ohne Adminrechte). Nach Neustart prüfen, ob der Tray-Status **grün** (ready) ist.

#### 6. Status prüfen

| Wo | Was prüfen |
|----|------------|
| RTX Tray / Agent | `GET /health` → `ready`, `disabled`, `starting` oder `error` |
| UWE Studio | Admin-Dashboard: RTX online/offline/deaktiviert, lokale KI bereit, Cloud konfiguriert |
| Manuell | `curl -H "Authorization: Bearer <RTX_AGENT_TOKEN>" http://192.168.x.x:8787/health` |

Healthcheck-Intervall und Timeout in UWE:

```env
RTX_HEALTHCHECK_INTERVAL_MS=10000
RTX_TIMEOUT_MS=3000
```

### Cloud-Fallback

Cloud-Fallback gilt **ausschließlich** für:

- KI-Modus **Auto**
- Kontext **Allgemeiner Chat**
- RTX nicht bereit **und** Cloud-KI konfiguriert

Cloud-Fallback sendet **niemals**:

- Brain / DnD-/World-Wissen
- Aktuelles Objekt
- Sessions, NPCs, Orte, Kanon, Dungeons
- Beliebige anderen lokalen UWE-Daten

Ohne Cloud-Konfiguration oder bei allen anderen Kontextmodi: Anfrage **blockieren**, wenn RTX nicht ready ist.

Cloud-KI konfigurieren (nur Host-`.env`):

```env
CLOUD_AI_PROVIDER=openai
CLOUD_AI_API_KEY=sk-...
CLOUD_AI_MODEL=gpt-4o-mini
```

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

## Feature-Status (Kurzüberblick)

| Bereich | Status | Hinweis |
|---------|--------|---------|
| Studio/Portal Session-Login, Setup, Passwort-Reset | ✅ done | `/login`, `/setup`, `/forgot-password` |
| Rollen (owner/admin/dm/player) | ✅ done | [SECURITY.md](SECURITY.md) |
| DM-only / Portal-Leak-Schutz | ✅ done | Hard tests + Inspector + Leak Scanner |
| Daily Admin OS (Today, Capture, Life-Brain) | ✅ done | Basis-UI; Mobile auf einigen Welt-Views noch lückenhaft |
| DnD-KI-Generator, Brain, RTX-Router | ✅ done | Cloud nur für Allgemeinen Chat |
| Static HTML Export | ✅ done | `pnpm export:static` |
| Label-Druck (6×4, PDF/HTML) | ✅ done | [docs/LABELS.md](docs/LABELS.md) |
| Backup/Restore (API, CLI, Windows) | 🔶 partial | Kernfunktionen da; einige Metadaten noch nicht im Backup — [docs/BACKUP.md](docs/BACKUP.md) |
| Image Studio | 🔶 partial | Phase 2 (Inpaint, Varianten); kein Canvas-Editor — [docs/IMAGE_STUDIO.md](docs/IMAGE_STUDIO.md) |
| Kalender | 🔶 partial | Phase 2 (Wochenansicht, Feeds); CalDAV Write-back offen — [docs/CALENDAR_INTEGRATION.md](docs/CALENDAR_INTEGRATION.md) |
| DnD API (Open5e, SRD) | 🔶 partial | Suche + Statblock-Import; Encounter-Builder offen — [docs/DND_API_INTEGRATION.md](docs/DND_API_INTEGRATION.md) |
| Agent Jobs (GitHub Actions) | 🔶 partial | Dispatch + Polling; kein Auto-Merge — [docs/AGENT_JOBS.md](docs/AGENT_JOBS.md) |
| 2FA | 🔲 planned | Schema vorbereitet, Login-Flow fehlt |
| E2E-Tests Auth-Flows | ✅ done | Playwright-Baseline (`e2e/`) im CI |
| PostgreSQL-Option | ✅ done | Dual-Client + Baseline-Migration — [docs/postgresql.md](docs/postgresql.md) |
| Markdown/HTML Export | ✅ done | `pnpm export:wiki` (Portal + DM-Kontext) |
| Asset-Datei-Import (Bulk) | 🔲 planned | Einzel-Upload vorhanden |
| Code Cleanup / Doku-Drift | 🔶 partial | Laufend |

---

## Roadmap

### Done

- [x] Docker Compose für Studio + Portal + persistente Datenbank
- [x] Native Auth: Login, Setup, Passwort-Reset, Rollen
- [x] Static HTML Export für player-sichere Wiki-Seiten
- [x] KnoteForge-Import (JSON) mit Preview, Mapping und Duplikaterkennung
- [x] Session Management für Welten und Kampagnen
- [x] Soundboard (lokale Sounds, YouTube, Spotify OAuth + Web-API-Playback im Studio)
- [x] Label-Druck, World Inspector, Activity Log, Command Palette
- [x] Daily Admin OS Basis (Today, Capture, Projekte, Werkstatt, Verträge, Hardware, Life-Brain)

### Partial / in progress

Details: [docs/ROADMAP.md](docs/ROADMAP.md) · [docs/FEATURE_MATURITY_MATRIX.md](docs/FEATURE_MATURITY_MATRIX.md)

- [ ] Image Studio — Canvas-Editor, Cloud-Edit-Härtung
- [ ] Kalender — CalDAV Write-back, Session ↔ Event Auto-Sync
- [ ] Agent Jobs — Completion-Callback, Cursor CLI Härtung
- [ ] Backup/Restore-Vollständigkeit (PageTemplates, ShareLinks ohne Tokens, Auto-Scheduler)
- [ ] Mobile-UI für alle Welt-Unterseiten
- [ ] Secrets/Reveal Studio-UI, Import Undo

### Planned / not started

- [ ] 2FA-Aktivierung (TOTP-Login-Integration)
- [ ] Asset-Datei-Import (Karten, Sounds, Handouts als Bulk)
- [ ] Performance-Budget + Stress-Testwelt
- [ ] Tag-/Taxonomie-Aufräumer
- [ ] Code Cleanup / Reduction (Legacy-Pfade, tote CSS)

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
  soundboard/      # Active sound state + Spotify Web API adapter (Studio OAuth)
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
| `AUTH_SECRET` | Encrypts Spotify tokens and other secrets — set a strong value in production and **do not rotate** after Spotify connect without reconnecting |
| `STUDIO_API_TOKEN` | Optional bearer token guarding sensitive Studio APIs |
| `SPOTIFY_CLIENT_ID` | Spotify OAuth client ID (Studio soundboard, optional) |
| `SPOTIFY_CLIENT_SECRET` | Spotify OAuth client secret (optional) |
| `SPOTIFY_REDIRECT_URI` | Spotify OAuth callback, e.g. `http://localhost:3000/api/spotify/callback` |
| `RUN_DB_SEED` | Demo seed: `auto` (first empty DB), `true`, or `false` (production) |
| `UWE_SETUP_TOKEN` | One-time owner bootstrap via Studio `/setup` (required in production first-run) |
| `AUTH_REQUIRED` | Enforce login on Studio/Portal in production (`true` default) |
| `RTX_AGENT_URL` | Heimnetz-URL des UWE RTX-Agent (z. B. `http://192.168.x.x:8787`) |
| `RTX_AGENT_TOKEN` | Shared Secret für RTX-Agent (serverseitig, nicht im Frontend) |
| `RTX_HEALTHCHECK_INTERVAL_MS` | Intervall für RTX-Statusprüfung (Standard: `10000`) |
| `RTX_TIMEOUT_MS` | Timeout pro RTX-Healthcheck (Standard: `3000`) |
| `PREFERRED_LOCAL_MODEL` | Bevorzugtes lokales Modell für RTX |
| `CLOUD_AI_PROVIDER` | Cloud-Anbieter für Allgemeinen Chat (z. B. `openai`) |
| `CLOUD_AI_API_KEY` | API-Key — nur in `.env`, nie in Git |
| `CLOUD_AI_MODEL` | Cloud-Modell für Allgemeinen Chat |

Weitere Brain-/Inferenz-Variablen: siehe `.env.example` und Abschnitt [KI-System](#ki-system-brain--rtx).

## Backup & Restore

| Methode | Dokument |
|---------|----------|
| Studio UI | Studio → Backup erstellen / Wiederherstellen |
| CLI | `pnpm backup` · `pnpm backup:create` |
| Windows Steuerung | Desktop „UWE Steuerung“ → Backup erstellen |
| Architektur & Rollen | [docs/BACKUP.md](docs/BACKUP.md) · [docs/backup-restore.md](docs/backup-restore.md) |

Backups enthalten Welten, Seiten, Uploads und Settings (sanitized). **Nicht enthalten:** Passwort-Hashes, Session-Tokens, API-Keys. Restore nur als `owner`.

---

## Security & Production

| Thema | Dokument |
|-------|----------|
| Security Policy (Source of Truth) | [SECURITY.md](SECURITY.md) |
| KI/RTX Datenschutz | [SECURITY_NOTES.md](SECURITY_NOTES.md) |
| Auth, API-Tokens, Rate Limits | [docs/auth-api-security.md](docs/auth-api-security.md) |
| Production Deployment | [docs/PRODUCTION.md](docs/PRODUCTION.md) |
| Cloudflare Tunnel + Access | [DEPLOYMENT_SECURITY.md](DEPLOYMENT_SECURITY.md) · [docs/cloudflare-access.md](docs/cloudflare-access.md) |
| Linux Host Hardening | [docs/deployment-hardening.md](docs/deployment-hardening.md) |

**Studio** has session login (`/login`) for `owner`/`admin`/`dm`, but still grants DM-level access after login — never expose it to the public internet without **Cloudflare Access, VPN, or reverse-proxy auth** in addition. Set `STUDIO_API_TOKEN` when APIs may be reachable from untrusted networks.

**Portal** may be hosted more openly; only content marked `player_visible` or `public` (and published) is served on `/worlds/*`.

> **Warning:** Never expose the RTX agent, Ollama, or LM Studio to the internet. Cloudflare Tunnel must point **only** to UWE (Studio + Portal), never to inference endpoints.

---

## License

Private project — all rights reserved.

## Release

| Document | Purpose |
|----------|---------|
| [CHANGELOG.md](CHANGELOG.md) | Release notes |
| [docs/PRODUCTION.md](docs/PRODUCTION.md) | Production deployment, updates, backup |
| [SECURITY.md](SECURITY.md) | Security policy and checklist |
| [SECURITY_NOTES.md](SECURITY_NOTES.md) | KI-Datenschutz, RTX-Agent, Cloud-Regeln |
| [docs/daily-admin-os.md](docs/daily-admin-os.md) | Daily Admin OS — Zielstruktur und Integrationsstatus |
| [docs/dnd-generator-upgrade.md](docs/dnd-generator-upgrade.md) | DnD-KI-Generator — Aktionen, Review, Player-Safety |
| [docs/life-brain-privacy.md](docs/life-brain-privacy.md) | Privacy-Regeln für persönliches Brain |
| [VERSION](VERSION) | Current product version |
