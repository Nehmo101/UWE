# UWE — Universeller Welten-Editor

**UWE** is a self-hosted **Alltags- und Hobby-Betriebssystem**: Daily Admin OS, DnD campaign brain, player portal, and optional local AI — all on your own hardware.

| Component | Name | Purpose |
|-----------|------|---------|
| Product | **UWE** | Overall platform |
| DM App | **UWE Studio** | World/campaign editor, Daily Admin OS, AI workflows (DM-only) |
| Player App | **UWE Portal** | Player-facing wiki and handouts (live web app + API) |
| Export | **Static Export** | Player-safe HTML export for simple hosting |
| Backend | **UWE Core** | Shared data layer, auth, wiki engine (packages) |
| Integrations | **RTX Connector, Mail, Calendar, …** | Optional outbound local worker, SMTP, calendar feeds, DnD APIs |

> Self-hosted Daily Admin OS and campaign brain — no cloud required for core data.

Architektur: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Design Style Guide

UWE ships a dedicated **Design Style Guide** — the single source of truth for
UWE's visual language: color tokens, typography, the nine-theme engine,
reusable UI components, and full-screen recreations of Studio and Portal.

📁 [`design-system/`](design-system/) · start with [`design-system/README.md`](design-system/README.md)

**Signature look — Parchment OS** (the default theme for both Studio and Portal):
warm paper `#f1e8d4`, ink text `#211d17`, terracotta accent `#c2622b`, teal links,
a dark-ink sidebar, **Space Mono** UI + **Newsreader** headings.

| Layer | Where |
|-------|-------|
| Tokens (colors, type, spacing) + 9 themes | `design-system/styles.css` → `design-system/tokens/*` |
| Reusable components (Button, Card, badges, SecretReveal, …) | `design-system/components/*` |
| Product recreations (Studio cockpit, Portal wiki) | `design-system/ui_kits/*` |
| Foundation specimen cards | `design-system/guidelines/*` |
| Full guide (voice, visual foundations, iconography) | `design-system/README.md` |

Consuming a page is one link + one theme attribute:

```html
<html data-uwe-theme="uwe-parchment-os">
<link rel="stylesheet" href="design-system/styles.css" />
<script src="design-system/_ds_bundle.js"></script>
<script>const { Button, Card } = window.UWEDesignSystem_f43eab;</script>
```

Foundations mirror the live product (`packages/shared-ui/src/uwe.css`,
`src/theme/themes.ts`, `src/design-v2/*`); the guide is the canonical reference
when building new UWE interfaces or assets.

### Daily Admin OS

UWE ist ein **tägliches privates Admin-Cockpit** neben dem DnD-Editor: Heute-Dashboard, Capture-Inbox, Projekte, Werkstatt, Verträge, Hardware/Homelab und persönliches Life-Brain.

| Bereich | Status |
|---------|--------|
| DnD-Welten, Brain, KI-Router, Admin Status | ✅ done |
| Mobile Bottom Nav, KI-Prompt, Capture FAB | ✅ done |
| `/today`, `/capture`, `/projects`, `/workshop`, `/contracts`, `/hardware`, `/life-brain` | ✅ done (Basis-UI) |
| Mail Center, Kalender, Image Studio (Studio-only) | ✅ done (Kern) |
| Admin Mail Portal (`/admin/mail`) | ✅ done (Basis: IMAP/SMTP, Inbox, Priorisierung, KI-Entwürfe) |
| Kalender-Widget auf `/today`, Capture-Bild-Upload, Life-Brain-Retrieval | 🔶 partial |
| Erweiterte Mobile-Views auf allen Welt-Unterseiten | 🔶 partial |

Details: [docs/daily-admin-os.md](docs/daily-admin-os.md) · Reifegrad: [docs/FEATURE_MATURITY_MATRIX.md](docs/FEATURE_MATURITY_MATRIX.md)

---

## Zielmodell: UWE Host (Linux) + RTX Connector

UWE besteht aus zwei klaren Rollen:

| Rolle | Läuft auf | Verantwortlich für |
|-------|-----------|--------------------|
| **UWE Host** (always-on) | kleiner Linux-Host (alter Laptop) | Website, Studio, Portal, DB, Auth, Uploads, Queue, Settings, öffentliche Erreichbarkeit. **Source of Truth.** |
| **RTX Host Connector** (optional) | RTX-PC / Haupt-PC | lokale Leistung als **ausgehender** Worker: Audio, Spotify, Ollama-LLM, Embeddings und optional lokale Bildgenerierung. |

```text
RTX Connector  ───────▶  UWE Host        (Connector verbindet sich ausgehend)
```

**Wichtig:** Der RTX Connector ist **niemals** Voraussetzung dafür, dass UWE online ist.
Website, Studio und Portal laufen vollständig ohne ihn. Ist der Connector offline oder meldet
eine Capability nicht, zeigen lokale KI-/Audio-/Bild-Funktionen einen ehrlichen Degraded-Status — kein Crash.

Capabilities werden nur gemeldet, wenn ein echter Executor konfiguriert ist: `audio_local` braucht `UWE_CONNECTOR_AUDIO_CMD`, `spotify_connect` braucht Spotify-Token plus Device-ID, lokale LLMs bleiben im Connector vorerst Ollama-only, und `image_generation` braucht `UWE_CONNECTOR_IMAGE_CMD`. Cloud-KI wird über das UWE-Interface/Gateway angebunden, nicht über falsche Connector-Capabilities.

> **Hinweis:** Docker und der Windows-One-Click-Installer sind **kein** aktiver Produktpfad
> mehr. Der Zielweg ist Linux-Host + pnpm + systemd (+ optional Cloudflare Tunnel) und der
> optionale RTX Connector. Siehe [docs/removed-legacy-runtime.md](docs/removed-legacy-runtime.md).

## Quick start (Linux Host)

```bash
git clone https://github.com/nehmo101/uwe
cd uwe
cp .env.example .env            # AUTH_SECRET/SESSION_SECRET setzen
pnpm install --frozen-lockfile
pnpm --filter @uwe/database db:deploy   # Migrationen
pnpm --filter @uwe/database db:seed     # Demo-Welt + Login dm@uwe.local / uwe-dev
pnpm build:release
pnpm host:start                 # startet Studio (3000) + Portal (3001)
```

| App | URL | Zweck |
|-----|-----|-------|
| **UWE Studio** (DM) | http://localhost:3000 | Welten bearbeiten |
| **UWE Portal** (Spieler) | http://localhost:3001 | Wiki & Handouts |

Status prüfen: `pnpm host:status` · `curl http://localhost:3000/api/health`.
Für einen produktiven, dauerhaft laufenden Host (systemd, Cloudflare Tunnel) siehe das
**One-Shot Setup** unten und [docs/host-linux.md](docs/host-linux.md).

## RTX Connector starten (optional)

Auf dem RTX-PC, nachdem im Studio unter **System → RTX Connector** ein Token erzeugt wurde:

```bash
cp tools/uwe-rtx-connector/.env.example tools/uwe-rtx-connector/.env
# UWE_HOST_URL und UWE_CONNECTOR_TOKEN eintragen
pnpm connector:start
```

Details: [docs/rtx-connector.md](docs/rtx-connector.md) ·
[docs/connector-security.md](docs/connector-security.md) ·
[docs/soundboard-worker-flow.md](docs/soundboard-worker-flow.md) ·
[docs/local-llm-setup.md](docs/local-llm-setup.md).

---

## UWE Host One-Shot Setup

Einmaliges bzw. wiederholbares Linux-Host-Setup für den **alten UWE-Host-Laptop** (systemd, SQLite unter `/var/lib/uwe`, LAN-Erreichbarkeit). Nach einem Git-Pull genügt ein Befehl — idempotent und ohne Secrets im Repository.

### Voraussetzungen

| Voraussetzung | Hinweis |
|---------------|---------|
| Linux mit systemd | Ubuntu 22.04/24.04 oder Debian 12 empfohlen |
| Node.js 22 (Host) | Production-Setup installiert Node 22; lokale Checks sollen ebenfalls Node 22 nutzen |
| pnpm ≥ 10 | `corepack enable && corepack prepare pnpm@latest --activate` |
| git | Repository typischerweise unter `/opt/uwe` |
| root/sudo | Script muss als root laufen |

Optional: UFW — falls aktiv, öffnet das Script Port `3000/tcp` für Studio im LAN.

### Einmaliger Befehl

```bash
cd /opt/uwe
git pull   # falls noch nicht geklont
sudo bash ./deploy/scripts/setup-uwe-host.sh
```

Danach ist UWE lokal und im LAN erreichbar, z. B.:

- **Studio (lokal):** `http://127.0.0.1:3000/studio`
- **Studio (LAN):** `http://<HOST-IP>:3000/studio` (IP mit `hostname -I`)

Production-Env und Secrets liegen unter **`/etc/uwe/uwe.env`** (nicht im Git). Vor Internet-Exposure: `AUTH_SECRET` setzen, siehe [docs/PRODUCTION.md](docs/PRODUCTION.md).

### Nach Neustart starten

| Umgebung | Befehl |
|----------|--------|
| **Linux systemd (Production)** | `sudo systemctl start uwe.service` — Autostart: `sudo systemctl enable uwe.service` |
| **Status prüfen** | `sudo bash ./scripts/uwe-host-status.sh --healthcheck` |
| **Host-Scripts** | `pnpm host:start` / `pnpm host:status` / `pnpm host:stop` |
| **Entwicklung** | `pnpm dev` (Studio `:3000`, Portal `:3001`) |

### Cloudflare + lokale Services

Typisches Setup: **Cloudflare Tunnel** leitet öffentliche Hostnames auf lokale Ports — Studio `:3000`, Portal `:3001`. Pfade (`STUDIO_PATH`, `PORTAL_PATH`) und Access-Policies sind in [docs/cloudflare-access.md](docs/cloudflare-access.md) dokumentiert. Der Admin-Status unter `/admin/status` zeigt erwartete URLs, Proxy-Flags und Healthchecks (ohne Secrets). `cloudflared` wird nicht vom Setup-Script installiert — siehe [docs/deployment-hardening.md](docs/deployment-hardening.md).

### Erstes Setup (Owner anlegen)

Nach dem Host-Setup ist Studio erreichbar, aber noch **kein Benutzer** angelegt. `/setup` ist ohne `Authorization`-Header zugänglich, solange kein Owner existiert (auch wenn `STUDIO_API_TOKEN` gesetzt ist).

1. Secrets in `/etc/uwe/uwe.env` setzen und Service neu starten:

   ```bash
   sudo nano /etc/uwe/uwe.env
   # AUTH_SECRET=<openssl rand -base64 32>
   # UWE_SETUP_TOKEN=<openssl rand -hex 32>
   # STUDIO_API_TOKEN=<openssl rand -base64 32>   # empfohlen
   # RUN_DB_SEED=false
   sudo systemctl restart uwe.service
   ```

2. Browser öffnen: **`http://127.0.0.1:3000/setup`** (LAN: `http://<HOST-IP>:3000/setup`)

3. Setup-Token aus `UWE_SETUP_TOKEN` eingeben und Owner-Konto anlegen.

4. Nach erfolgreichem Setup leitet `/setup` zur Anmeldung um; erneutes Setup ist blockiert.

Prüfen (ohne Bearer-Token — sollte JSON mit `setupAvailable` liefern):

```bash
curl -s http://127.0.0.1:3000/api/auth/setup
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/setup   # 200 vor Setup
```

Details: [docs/PRODUCTION.md](docs/PRODUCTION.md), [docs/SECURITY_QA_MATRIX.md](docs/SECURITY_QA_MATRIX.md).

### Was das Script macht

1. Prüft root, erkennt das Repo (`/opt/uwe` oder Pfad relativ zum Script)
2. Migriert ggf. veralteten `uwe-host.service` → `uwe.service`
3. Legt User `uwe`, Verzeichnisse `/etc/uwe`, `/var/lib/uwe`, `/var/log/uwe`, `/var/backups/uwe` an
4. Ergänzt `/etc/uwe/uwe.env` (fehlende Variablen/Secrets — **überschreibt keine** bestehenden Werte)
5. Führt `pnpm install`, `pnpm --filter @uwe/database db:generate`, `db:deploy` und `pnpm build` aus (inkl. Standalone-Prisma-Runtime)
6. Prüft Standalone-Module (`@prisma/adapter-libsql`, `pg`, …) — bricht ab, wenn Dependencies fehlen
7. Installiert/aktualisiert `uwe.service` (LAN-Bind `0.0.0.0`, systemd PATH, kein `127.0.0.1`)
8. Startet systemd, HTTP-Healthchecks, optional UFW-Regel, Status und URLs

**Modi:** `--quick` (schnelles Update), `--repair` (Node/pnpm + node_modules), `--healthcheck` (read-only), `--fresh` (Reset mit `DELETE-UWE`-Bestätigung).

Details: [docs/UWE_HOST_LINUX_STARTUP.md](docs/UWE_HOST_LINUX_STARTUP.md), Cloudflare: [docs/deployment-hardening.md](docs/deployment-hardening.md).

### Troubleshooting

| Problem | Reparatur |
|---------|-----------|
| `Cannot find module '@prisma/adapter-libsql'` | `sudo bash ./deploy/scripts/setup-uwe-host.sh --repair` |
| `exec: node: not found` | `--repair` (NodeSource Node 22 + systemd PATH) |
| HTTP 500 auf `/api/health` oder `/setup` | Logs + Standalone-Checks, dann `--repair` |
| Prisma command not found | `pnpm --filter @uwe/database db:generate` / `db:deploy` |

Details: [docs/UWE_HOST_LINUX_STARTUP.md](docs/UWE_HOST_LINUX_STARTUP.md#fehlerbehebung)

```bash
# Service-Status und Logs
sudo systemctl status uwe.service --no-pager
journalctl -u uwe.service -n 80 --no-pager

# Standalone-Runtime nach Build prüfen
cd /opt/uwe
node scripts/check-standalone-prisma-deps.mjs studio
node scripts/check-standalone-prisma-deps.mjs portal

# Lauscht Studio auf 0.0.0.0:3000?
ss -tulpn | grep 3000

# HTTP-Test (Studio-Pfad oder Root)
curl -i http://127.0.0.1:3000/api/health
curl -i http://127.0.0.1:3000/setup
curl -i http://127.0.0.1:3001/api/health

# Env lesbar für User uwe?
sudo -u uwe test -r /etc/uwe/uwe.env && echo OK

# Setup erneut ausführen (idempotent)
sudo bash /opt/uwe/deploy/scripts/setup-uwe-host.sh --quick

# Healthcheck (read-only)
sudo bash /opt/uwe/deploy/scripts/setup-uwe-host.sh --healthcheck
```

### Nach Git-Pull neu bauen

```bash
cd /opt/uwe
git pull
sudo bash ./deploy/scripts/setup-uwe-host.sh --quick
```

Weitere Modi: `--repair` (gründliche Reparatur), `--healthcheck` (read-only), `--fresh` (destruktiver Reset). Siehe [docs/UWE_HOST_LINUX_STARTUP.md](docs/UWE_HOST_LINUX_STARTUP.md).

---

## Linux Production Host (pnpm host scripts)

Convenience-Wrapper um den offiziellen **Production-Flow** (`uwe.service` + `/etc/uwe/uwe.env`). Startet **keinen** parallelen Legacy-Prozess.

```bash
cd /opt/uwe
pnpm host:start          # sudo systemctl start uwe
pnpm host:status         # Service-Status + Erreichbarkeit
pnpm host:stop           # sudo systemctl stop uwe
pnpm host:install-autostart   # ruft setup-uwe-host.sh auf
```

Erstinstallation und Updates: [UWE Host One-Shot Setup](#uwe-host-one-shot-setup) oben bzw. `docs/UWE_HOST_LINUX_STARTUP.md`.

Persistente Produktionsdaten: `/var/lib/uwe` (DB, Uploads), `/var/backups/uwe` (Backups).

---

## Alternative: Lokale Entwicklung

### Prerequisites

- **Node.js** 22
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

### CI gate

**GitHub Cloud CI is the authoritative gate.** A PR is mergeable when its GitHub
checks are green — `pr-check.yml` (`pnpm ci:light`) on every PR and the full
`pnpm quality` gate on `main`. See [docs/engineering/ci.md](docs/engineering/ci.md).

The commands below are an **optional local pre-check** (not required, not self-hosted):

```bash
pnpm install --frozen-lockfile
pnpm --filter @uwe/database db:generate
pnpm lint
pnpm typecheck
pnpm test:ci
pnpm test:security
pnpm build:release
```

Linting uses a single flat ESLint config at the repo root (`eslint.config.mjs`) with
`eslint-config-next` (core-web-vitals + TypeScript rules) for both apps and all
shared packages. Run `pnpm lint` from the repo root; there are no per-package lint
scripts.

Current version: **0.1.0** (see `VERSION` and [CHANGELOG.md](CHANGELOG.md)).

---

## DM Workflow Highlights (Studio)

- **KI-gestützter DnD-Generator** — kontextuelle Aktionen (NPC, Ort, Dungeon-Raum, Encounter, Handout, Kanonprüfung, Session-Vorbereitung) über lokale RTX/Ollama oder erlaubte Cloud-Modi; Review/Apply-Workflow, keine automatische Kanonisierung. Details: [docs/dnd-generator-upgrade.md](docs/dnd-generator-upgrade.md).
- **World Overview** — `/worlds/[slug]/dashboard` is the per-world start page: stats, next session, open plots, recently edited pages, player-note review queue, portal status, and quick-create shortcuts.
- **Command Palette** — press `Ctrl/⌘ + K` anywhere in Studio to jump to any view, quick-create entities, switch worlds, or search pages live.
- **Quick Create with templates** — the new-page form offers templates (NPC, Ort, Fraktion, Quest, Session-Plan, Handout) that pre-fill player-visible content plus DM-only note blocks. Slugs are optional and generated automatically. Templates are DB-backed and user-editable at `/templates` (create, edit, duplicate, deactivate); the built-in set is seeded once as system templates.
- **World Inspector with fix actions** — `/worlds/[slug]/inspector` audits what players can actually see: portal-visible pages/blocks/assets, share links (password/expiry), safety findings (e.g. player-visible GM notes), and canon warnings (broken wiki links, duplicate names, contradictions, orphan pages, unassigned pages). Findings link directly to the affected page/block and offer one-click fixes (e.g. set block to DM-only, convert broken wikilinks to text) — every fix is logged and undoable.
- **Activity Log & Next Actions** — the Studio dashboard shows an audit log (content/visibility changes, inspector fixes, template usage, imports/exports, backups, errors) with links to affected objects and inline undo, plus a "Next Actions" section (open findings, backup age, unassigned content, publicly visible player content, seed/migration problems).
- **Label-Druck** — `/worlds/[slug]/labels`: visueller 6×4-Zoll-Editor, Templates, Drucklisten, PDF/HTML-Export, DM/Player-Sicherheit. Details: [docs/LABELS.md](docs/LABELS.md).
- **Image Studio** — `/image-studio`: Bildgenerierung, Varianten und Inpaint (RTX bevorzugt, optional Cloud nur für `generate`/`variant`). Details: [docs/IMAGE_STUDIO.md](docs/IMAGE_STUDIO.md).
- **Kalender** — `/calendar`: lokaler Kalender, iCal/CalDAV/FamilyWall-Feeds, Monats- und Wochenansicht. Details: [docs/CALENDAR_INTEGRATION.md](docs/CALENDAR_INTEGRATION.md).
- **Mail Center** — `/mail`: SMTP-Vorlagen für Session-Erinnerungen, Backup-Warnungen, Vertrags-Hinweise (self-hosted, Studio-only). Details: [docs/ai-brain-mail/README.md](docs/ai-brain-mail/README.md).
- **DnD API** — Open5e/SRD-Suche und Statblock-Import in Studio (dm_only). Details: [docs/DND_API_INTEGRATION.md](docs/DND_API_INTEGRATION.md).

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
| `/account/security` | Studio | TOTP 2FA setup and disable |
| `/auth/account/password` | Portal | Change password (logged-in) |
| `/auth/account/security` | Portal | TOTP 2FA setup and disable |

**First-run (production):** Set `UWE_SETUP_TOKEN` and `RUN_DB_SEED=false`, open Studio `/setup`, create the owner account. Setup is disabled automatically once an owner exists. See [docs/PRODUCTION.md](docs/PRODUCTION.md) and [docs/SECURITY_QA_MATRIX.md](docs/SECURITY_QA_MATRIX.md).

**Password reset:** Self-service via `/forgot-password` and `/reset-password` (both apps). Admins can also reset via Studio (`/api/admin/users/[id]/reset-password`). Details: [docs/auth-api-security.md](docs/auth-api-security.md).

**Auth UI:** Login, landing, password reset, and first-run setup share the dark UWE auth shell (`AuthPageLayout`, `AuthBrandingPanel` in `@uwe/shared-ui`). See [docs/auth-api-security.md](docs/auth-api-security.md#auth-ui-shared).

**Roles:** `owner` / `admin` / `dm` → Studio; `player` → Portal only; `guest` / `readonly` → public wiki.

**Protected vs public routes:** Central policy in `@uwe/auth` (`route-policy.ts`). Security QA matrix: [docs/SECURITY_QA_MATRIX.md](docs/SECURITY_QA_MATRIX.md).

**Naming note:** Studio labels `player_visible` as **"Portal sichtbar"** (für Spieler freigegeben) — anything published with this visibility is readable by everyone who can reach the Portal's `/worlds/*` routes, no login required. `dm_only` content is never served on `/worlds/*`.

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

UWE Studio bietet ein **lokales Brain** (DnD-/World-Wissen, Sessions, Kanon) und optional **Cloud-KI** nur für allgemeine Fragen ohne Kampagnendaten. Die Zielarchitektur ist: UWE Host bleibt Source of Truth, lokale RTX-Leistung kommt über den **outbound RTX Host Connector**, und Cloud-KI wird über das UWE Interface/Gateway kontrolliert angebunden.

### AI Gateway & RTX-Fallback

Alle KI-Aufrufe laufen über das **zentrale AI Gateway** (`packages/ai-brain/src/gateway/`):

```txt
Permission → Privacy → Budget → RTX Health → Provider → Usage Log
```

| Thema | Details |
|-------|---------|
| **Standard** | Lokale RTX bevorzugt (`LOCAL_THEN_CLOUD`) |
| **Lokaler Connector** | Der outbound Connector meldet `llm_local` / `embedding_local` nur für erreichbare Ollama-Modelle. |
| **Cloud-Fallback** | Nur wenn Master-Admin (Owner) global freigibt |
| **Provider & API-Keys** | Nur Master-Admin — verschlüsselt in DB, nie im Frontend |
| **User-Freigaben** | z. B. Carina gezielt für KI-Features freischalten |
| **Privacy** | Brain, Life Brain, private Notizen → standardmäßig **kein Cloud** |
| **Budgets & Logs** | Tages-/Monats-/User-Limits, vollständige Nutzungsprotokolle |

**Setup:** Studio → Cookbook → **KI & RTX Fallback** (`/admin/ai-gateway`) — geführter Master-Admin-Wizard.

Dokumentation: [docs/ai-gateway.md](docs/ai-gateway.md) · [docs/ai-provider-setup.md](docs/ai-provider-setup.md) · [docs/ai-privacy-and-cloud-fallback.md](docs/ai-privacy-and-cloud-fallback.md) · [docs/ai-troubleshooting.md](docs/ai-troubleshooting.md) · [docs/ai-brain-connector-migration.md](docs/ai-brain-connector-migration.md)

**Wichtig:** DnD-Weltwissen, persönliches Life-Brain und private Notizen dürfen standardmäßig **nicht** an Cloud-Provider — siehe Privacy-Regeln im Admin-Wizard.

**ENV (Beispiele, keine echten Secrets):**

```env
UWE_HOST_URL=https://uwe.example
UWE_CONNECTOR_TOKEN=uwec_...
OLLAMA_BASE_URL=http://127.0.0.1:11434
# Optional Cloud-Fallback (zusätzlich im Admin-Wizard konfigurierbar):
OPENAI_API_KEY=<optional>
CLOUD_AI_PROVIDER=openai
```

| Rolle | Rechner | Aufgabe |
|-------|---------|---------|
| **UWE Host** | Alter Laptop / Self-Host | Datenbank, Brain, Mail, Studio — **alle persistenten Daten** |
| **RTX Host Connector** | RTX-PC (Heimnetz) | Optionaler outbound Worker — **öffnet keinen Port und speichert keine UWE-Daten** |
| **Cloud-KI** | Externer Anbieter | Nur allgemeiner Chat — **kein Brain/Weltwissen** |

Details zur Sicherheit: [SECURITY_NOTES.md](SECURITY_NOTES.md) · Deployment: [docs/ai-brain-mail/ENV_AND_DEPLOYMENT.md](docs/ai-brain-mail/ENV_AND_DEPLOYMENT.md)

### KI-Modi

Wähle im Admin-Portal (Desktop oder mobil), **welcher Provider** die Anfrage ausführt:

| Modus | Verhalten |
|-------|-----------|
| **Auto** | Bevorzugt lokale RTX-KI. Bei **Allgemeinem Chat** und offline RTX: Fallback auf Cloud (wenn konfiguriert). Bei Brain oder aktuellem Objekt: **blockieren**, wenn RTX nicht bereit — **kein Cloud-Fallback**. |
| **Lokale KI / RTX** | Nur lokale RTX. Brain-, Objekt- und Weltkontext erlaubt, wenn RTX **ready** ist. RTX offline/deaktiviert → Anfrage wird abgelehnt. |
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

### RTX-Agent (Legacy inbound — entfernt)

> **Deprecated / entfernt.** Das alte inbound-Modell (UWE Host ruft in einen
> RTX-HTTP-Server hinein, `RTX_AGENT_URL`) wird **nicht mehr empfohlen**, und das
> Standalone-Tool `uwe-rtx-agent` wurde aus dem Repo entfernt
> ([docs/removed-legacy-runtime.md](docs/removed-legacy-runtime.md)).
>
> Aktiver Weg für lokale RTX-Leistung: der ausgehende **RTX Host Connector** —
> siehe Abschnitt **"RTX Connector starten (optional)"** oben und
> [docs/rtx-connector.md](docs/rtx-connector.md) (`pnpm connector:start`). Der Connector
> öffnet **keinen** Port am RTX-PC und verbindet sich ausschließlich ausgehend zum Host.
>
> Der inbound RTX-Agent inkl. ai-brain-LLM-Client (`rtx-agent-client`/`-provider`) wurde
> entfernt; `RTX_AGENT_URL` überlebt nur als Legacy-Alias der RTX-Worker-URL
> (`RTX_BASE_URL`). Für neue Installationen ist der Connector der einzige unterstützte Weg.

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

Stand: Juni 2026 · Kurz-Wahrheit: [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md) · Details: [docs/FEATURE_MATURITY_MATRIX.md](docs/FEATURE_MATURITY_MATRIX.md), [docs/ROADMAP.md](docs/ROADMAP.md)

| Bereich | Status | Hinweis |
|---------|--------|---------|
| Studio/Portal Session-Login, Setup, Passwort-Reset | ✅ done | `/login`, `/setup`, `/forgot-password` |
| TOTP 2FA | ✅ done | `/account/security` (Studio + Portal) |
| Rollen (owner/admin/dm/player) | ✅ done | [SECURITY.md](SECURITY.md) |
| DM-only / Portal-Leak-Schutz | ✅ done | Hard tests + Inspector + Leak Scanner |
| Daily Admin OS (Today, Capture, Life-Brain) | ✅ done | Basis-UI; Capture-Bild-Upload teils offen |
| DnD-KI-Generator, Brain, RTX-Router | ✅ done | Cloud nur für Allgemeinen Chat; Connector lokal vorerst Ollama-only |
| Static HTML Export | ✅ done | `pnpm export:static` |
| Markdown/HTML Wiki-Export | ✅ done | `pnpm export:wiki` |
| Label-Druck (6×4, PDF/HTML) | ✅ done | [docs/LABELS.md](docs/LABELS.md) |
| Backup/Restore (API, CLI) | ✅ done | Inkl. Auto-Backup-Scheduler — [docs/BACKUP.md](docs/BACKUP.md) |
| RTX Host Connector | 🔶 partial | Outbound Worker; ConnectorShell UI (Wave 2); Audio/Spotify/Image nur mit echten lokalen Backends — [docs/rtx-connector.md](docs/rtx-connector.md) |
| Image Studio | 🔶 partial | Generate/Variant/Inpaint + Masken-Canvas — [docs/IMAGE_STUDIO.md](docs/IMAGE_STUDIO.md) |
| Kalender | 🔶 partial | Monats-/Wochenansicht, Feeds, Session-Sync, CalDAV-Vollsync — [docs/CALENDAR_INTEGRATION.md](docs/CALENDAR_INTEGRATION.md) |
| DnD API (Open5e, SRD) | ✅ done | Suche + Statblock-Import + Encounter-Builder — [docs/DND_API_INTEGRATION.md](docs/DND_API_INTEGRATION.md) |
| Agent Jobs | 🔶 partial | Dispatch + Polling; kein Auto-Merge (by design) — [docs/AGENT_JOBS.md](docs/AGENT_JOBS.md) |
| Mail Center (SMTP) | ✅ done | Studio-only — [docs/ai-brain-mail/README.md](docs/ai-brain-mail/README.md) |
| Tag-/Taxonomie-Aufräumer | 🔶 partial | `/admin/tags` + Merge-API; zentrales Tag-Model optional — [docs/engineering/tag-taxonomy.md](docs/engineering/tag-taxonomy.md) |
| Secrets/Reveal (Spoiler-System) | ✅ done | Page + ContentBlock Editor, Leak-Schutz — [docs/FEATURE_MATURITY_MATRIX.md](docs/FEATURE_MATURITY_MATRIX.md) §7 |
| Performance-Budget + Stress-Seed | 🔶 partial | CI smoke + Bundle-Budget; keine Browser-LCP-Gates — [docs/engineering/performance.md](docs/engineering/performance.md) |
| E2E-Tests Auth-Flows | ✅ done | Playwright-Baseline (`e2e/`) im CI |
| PostgreSQL-Option | ✅ done | Dual-Client + Baseline-Migration — [docs/postgresql.md](docs/postgresql.md) |
| Asset-Datei-Import (Bulk) | 🔲 planned | Einzel-Upload vorhanden |
| Import Undo | ✅ done | Activity-Log-Undo nach KnoteForge-Execute — [docs/FEATURE_MATURITY_MATRIX.md](docs/FEATURE_MATURITY_MATRIX.md) §6 |

---

## Roadmap

Details: [docs/ROADMAP.md](docs/ROADMAP.md) · [docs/FEATURE_MATURITY_MATRIX.md](docs/FEATURE_MATURITY_MATRIX.md)

### Done

- [x] Linux Host (pnpm + systemd) für Studio + Portal + persistente Datenbank
- [x] Native Auth: Login, Setup, Passwort-Reset, Rollen, TOTP 2FA
- [x] Static HTML Export und Markdown/HTML Wiki-Export für player-sichere Ausgabe
- [x] KnoteForge-Import (JSON) mit Preview, Mapping und Duplikaterkennung
- [x] Session Management für Welten und Kampagnen
- [x] Soundboard (lokale Sounds, YouTube, Spotify OAuth + Web-API-Playback im Studio)
- [x] Label-Druck, World Inspector, Activity Log, Command Palette
- [x] Daily Admin OS Basis (Today, Capture, Projekte, Werkstatt, Verträge, Hardware, Life-Brain)
- [x] Mail Center, Kalender (Kern), Image Studio (Generate/Variant/Inpaint), DnD API (Kern)
- [x] Backup/Restore (Welten, Templates, ShareLinks, Verschlüsselung, Pre-Restore-Safety)
- [x] PostgreSQL dual-client, E2E Auth-Baseline, CI Bundle-Budget + Performance-Smoke
- [x] Hard UI/UX Reset Wave 0–4: Shells, Nav-Vertrag, Legacy-Retirement, Auth-UI, E2E (siehe `docs/rework/implementation-status.md`)

- [x] Image Studio Masken-Canvas, CalDAV-Vollsync, Auto-Backup-Scheduler, Import Undo (PR #313)

### Partial / in progress

Siehe [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md) — aktuell kein bestätigter Produkt-Backlog.

Weitere Lücken ohne festen Slot: RTX Connector Packaging, Capture-Bild-Upload,
Life-Brain Retrieval, Performance-Browser-Gates, Tag-Taxonomie (optional).

### Planned / not started

- [ ] Asset-Datei-Import (Karten, Sounds, Handouts als Bulk)
- [ ] Distributed Session Store bei horizontaler Skalierung

---

## Architecture

UWE is a **pnpm monorepo** with **Turborepo**. Full overview: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

```
apps/
  studio/          # UWE Studio — DM editor + Daily Admin OS (port 3000)
  portal/          # UWE Portal — player wiki (port 3001)

packages/
  config/          # Shared TypeScript configs
  env/             # ENV parsing and guards
  shared-ui/       # Shared React components (Auth shell, MobileBottomNav, …)
  database/        # Prisma schema, repositories, domain services
  auth/            # Sessions, roles, route policy
  security/        # Security helpers
  security-tests/  # Authz and leak scanner tests
  shared-utils/    # Framework-agnostic utilities (slugs, lookup keys)
  static-export/   # Static HTML + wiki export
  assets/          # Upload paths, MIME validation, storage keys
  backup/          # Backup/restore CLI and bundle format
  soundboard/      # Active sound state + Spotify Web API (Studio OAuth)
  ai-brain/        # AI gateway, DnD generator, brain retrieval, RTX routing
  image-studio/    # Image generation jobs and RTX/cloud routing
  calendar/        # Calendar feeds, iCal/CalDAV
  mail/            # SMTP compose and templates
  dnd-api/         # Open5e/SRD integration
  knoteforge-import/  # JSON import pipeline
  agent-jobs/      # Agent dispatch
  cookbook/        # Admin setup wizards (AI gateway, …)
  web-search/      # Research helpers (Studio-only)

tools/
  uwe-rtx-connector/  # Optional outbound RTX Host Connector worker
  uwe-rtx-agent/      # Deprecated inbound local RTX inference worker
```

Stack: Next.js 15, React 19, TypeScript, Prisma 7, SQLite (libsql) with optional PostgreSQL.

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
| `UWE_HOST_URL` | Host URL used by the outbound RTX Connector |
| `UWE_CONNECTOR_TOKEN` | One-time connector token generated in Studio; plaintext lives only on the connector machine |
| `UWE_CONNECTOR_AUDIO_CMD` | Local audio command; enables `audio_local` when set |
| `SPOTIFY_DEVICE_ID` | Spotify Connect device for connector jobs |
| `SPOTIFY_ACCESS_TOKEN` / `UWE_CONNECTOR_SPOTIFY_ACCESS_TOKEN` | Enables `spotify_connect` together with `SPOTIFY_DEVICE_ID` |
| `UWE_CONNECTOR_IMAGE_CMD` | Local image worker command; enables `image_generation` when set |
| `UWE_CONNECTOR_PRINTERS` | JSON array of local printers for `label_printing`; auto-discovers via CUPS `lpstat -p` when unset |
| `UWE_CONNECTOR_PRINT_CMD` | Custom print command for label jobs (appends `--printer <id> --file <path>`); defaults to CUPS `lp` |
| `OLLAMA_BASE_URL` | Ollama endpoint for local connector LLM/embedding jobs |
| `RTX_AGENT_URL` | Deprecated inbound RTX-Agent URL for compatibility |
| `RTX_AGENT_TOKEN` | Shared Secret für deprecated RTX-Agent (serverseitig, nicht im Frontend) |
| `RTX_HEALTHCHECK_INTERVAL_MS` | Intervall für RTX-Statusprüfung (Standard: `10000`) |
| `RTX_TIMEOUT_MS` | Timeout pro RTX-Healthcheck (Standard: `3000`) |
| `PREFERRED_LOCAL_MODEL` | Bevorzugtes lokales Modell für RTX |
| `CLOUD_AI_PROVIDER` | Cloud-Anbieter für Allgemeinen Chat (z. B. `openai`) |
| `CLOUD_AI_API_KEY` | API-Key — nur in `.env`, nie in Git |
| `CLOUD_AI_MODEL` | Cloud-Modell für Allgemeinen Chat |

Weitere Brain-/Inferenz-Variablen: siehe `.env.example`, `tools/uwe-rtx-connector/.env.example` und Abschnitt [KI-System](#ki-system-brain--rtx).

## Backup & Restore

| Methode | Dokument |
|---------|----------|
| Studio UI | Studio → Backup erstellen / Wiederherstellen |
| CLI | `pnpm backup` · `pnpm backup:create` |
| Linux Host | `deploy/scripts/uwe-backup.sh` |
| Architektur & Rollen | [docs/BACKUP.md](docs/BACKUP.md) · [docs/backup-restore.md](docs/backup-restore.md) |

Backups enthalten Welten, Seiten, PageTemplates, Uploads und Settings (sanitized). ShareLinks werden ohne Tokens exportiert; Restore regeneriert Tokens. **Nicht enthalten:** Passwort-Hashes, Session-Tokens, API-Keys. Restore nur als `owner`. Auto-Backup über Settings → Host-Scheduler — siehe [docs/BACKUP.md](docs/BACKUP.md).

---

## Security & Production

| Thema | Dokument |
|-------|----------|
| Security Policy (Source of Truth) | [SECURITY.md](SECURITY.md) |
| KI/RTX Datenschutz | [SECURITY_NOTES.md](SECURITY_NOTES.md) |
| Auth, API-Tokens, Rate Limits | [docs/auth-api-security.md](docs/auth-api-security.md) |
| Production Deployment | [docs/PRODUCTION.md](docs/PRODUCTION.md) |
| Cloudflare Tunnel + Access | [docs/security/DEPLOYMENT_SECURITY.md](docs/security/DEPLOYMENT_SECURITY.md) · [docs/cloudflare-access.md](docs/cloudflare-access.md) |
| Linux Host Hardening | [docs/deployment-hardening.md](docs/deployment-hardening.md) |

**Studio** has session login (`/login`) for `owner`/`admin`/`dm`, but still grants DM-level access after login — never expose it to the public internet without **Cloudflare Access, VPN, or reverse-proxy auth** in addition. Set `STUDIO_API_TOKEN` when APIs may be reachable from untrusted networks.

**Portal** may be hosted more openly; only content marked `player_visible` or `public` (and published) is served on `/worlds/*`.

> **Warning:** Never expose the deprecated RTX agent, Ollama, LM Studio, llama.cpp, or local connector helper commands to the internet. Cloudflare Tunnel must point **only** to UWE (Studio + Portal), never to inference endpoints. The RTX Host Connector itself connects outbound and does not need an inbound port.

---

## License

Private project — all rights reserved.

## Release

| Document | Purpose |
|----------|---------|
| [CHANGELOG.md](CHANGELOG.md) | Release notes |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Product and repository architecture |
| [docs/PRODUCTION.md](docs/PRODUCTION.md) | Production deployment, updates, backup |
| [SECURITY.md](SECURITY.md) | Security policy and checklist |
| [SECURITY_NOTES.md](SECURITY_NOTES.md) | KI-Datenschutz, RTX-Agent, Cloud-Regeln |
| [docs/daily-admin-os.md](docs/daily-admin-os.md) | Daily Admin OS — routes and integration status |
| [docs/dnd-generator-upgrade.md](docs/dnd-generator-upgrade.md) | DnD-KI-Generator — actions, review, player safety |
| [docs/life-brain-privacy.md](docs/life-brain-privacy.md) | Privacy rules for personal brain |
| [docs/host-linux.md](docs/host-linux.md) | Linux Host setup and local CI gate |
| [docs/rtx-connector.md](docs/rtx-connector.md) | Outbound RTX Host Connector |
| [docs/engineering/ci.md](docs/engineering/ci.md) | CI workflows and local quality gates |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Planned and in-progress features |
| [docs/FEATURE_MATURITY_MATRIX.md](docs/FEATURE_MATURITY_MATRIX.md) | Honest feature maturity assessment |
| [VERSION](VERSION) | Current product version |
