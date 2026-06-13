# UWE — Produktion & Release

Anleitung für den ersten produktiven Betrieb von **UWE (Universeller Welten-Editor)**.

| Komponente | URL (Standard) | Zweck |
|------------|----------------|-------|
| UWE Studio | http://localhost:3000 | DM-Editor (nur für Spielleiter) |
| UWE Portal | http://localhost:3001 | Spieler-Wiki |

---

## Voraussetzungen

- **Docker** ≥ 24 und **Docker Compose** v2, oder
- **Node.js** ≥ 20 und **pnpm** ≥ 10 für manuellen Build

---

## Alter Laptop — Production Host

UWE ist für den dauerhaften Betrieb auf einem **alten Laptop** als zentraler Host vorgesehen (Datenbank, Uploads, Backups, Exports, später Brain/Mail). Der RTX-Rechner im Heimnetz bleibt ein separater Inference-Worker — siehe `docs/ai-brain-mail/ENV_AND_DEPLOYMENT.md`.

### Option A: Windows One-Click (empfohlen auf altem Laptop)

1. Node.js 20+ installieren
2. `UWE-Installieren.cmd` oder `pnpm installer:windows` ausführen
3. Im Assistenten **Installieren & Starten** wählen (Production-Modus: kein Demo-Seed)

Standard-Installationspfad: `%LOCALAPPDATA%\UWE`

| Pfad | Inhalt |
|------|--------|
| `%LOCALAPPDATA%\UWE\data\uwe.db` | SQLite-Datenbank |
| `%LOCALAPPDATA%\UWE\data\uploads` | Asset-Uploads |
| `%LOCALAPPDATA%\UWE\data\backups` | Backup-ZIPs |
| `%LOCALAPPDATA%\UWE\exports` | Static-HTML-Exporte |
| `%LOCALAPPDATA%\UWE\.env` | Konfiguration (nicht teilen) |

Details: [docs/windows-install.md](windows-install.md)

### Option B: Docker auf dem alten Laptop

Siehe [Schnellstart (Docker)](#schnellstart-docker--empfohlen) unten. Daten bleiben in Docker-Volume und Bind-Mounts erhalten.

### Option C: Manueller Production-Build (Node.js)

```bash
git clone <repository-url> uwe
cd uwe
cp .env.example .env
# .env für Production anpassen (siehe unten)
pnpm install --frozen-lockfile
pnpm build:release
pnpm db:migrate
pnpm --filter @uwe/studio start   # Port 3000
pnpm --filter @uwe/portal start   # Port 3001
```

### Persistente Pfade konfigurieren

Pfade können über **`.env`** (Production-Standard) oder optional über **Studio → Einstellungen → Storage/Backup** gesetzt werden. Studio-Einstellungen haben Vorrang vor ENV.

**Linux-Beispiel (alter Laptop):**

```env
NODE_ENV=production
UWE_DATA_DIR=/var/lib/uwe
DATABASE_URL=file:/var/lib/uwe/uwe.db
UWE_UPLOADS_DIR=/var/lib/uwe/uploads
UWE_BACKUP_DIR=/var/lib/uwe/backups
UWE_EXPORT_DIR=/var/lib/uwe/exports
AUTH_SECRET=<openssl rand -base64 32>
RUN_DB_SEED=false
STUDIO_API_TOKEN=<optional>
```

**Windows-Beispiel:**

```env
NODE_ENV=production
UWE_DATA_DIR=C:\UWE\data
DATABASE_URL=file:C:/UWE/data/uwe.db
UWE_UPLOADS_DIR=C:\UWE\data\uploads
UWE_BACKUP_DIR=C:\UWE\data\backups
UWE_EXPORT_DIR=C:\UWE\exports
AUTH_SECRET=<openssl rand -base64 32>
RUN_DB_SEED=false
```

Legacy-Aliase (`UPLOADS_DIR`, `BACKUPS_DIR`, `EXPORTS_DIR`) funktionieren weiterhin — siehe `.env.example`.

**Wichtig:** Diese Verzeichnisse beim Update **nicht löschen**. Vor Updates immer Backup erstellen.

### Production `.env` (Minimum)

```env
NODE_ENV=production
AUTH_SECRET=<starkes-zufaelliges-geheimnis>
RUN_DB_SEED=false
STUDIO_API_TOKEN=<optional-aber-empfohlen>
```

### Smoke-Checks nach Start

Nach jedem Erststart, Update oder Neustart des alten Laptops:

```powershell
# 1. Healthchecks (Studio + Portal)
curl http://localhost:3000/api/health
curl http://localhost:3001/api/health

# 2. Erwarteter Gesamtstatus
#    "status": "ok"  (oder "degraded" mit nachvollziehbarer Ursache in checks)

# 3. Storage prüfen — alle drei Verzeichnisse beschreibbar
#    checks.storage.uploadsWritable: true
#    checks.storage.backupsWritable: true
#    checks.storage.exportsWritable: true

# 4. Aufgelöste Pfade anzeigen (Diagnose, keine Secrets)
#    checks.storage.paths.dataDir / uploadsDir / backupsDir / exportsDir

# 5. Production-Warnungen im Studio-Dashboard prüfen
#    trust.runDbSeedDisabled sollte true sein (RUN_DB_SEED=false)
#    trust.authSecretLooksWeak sollte false sein
```

**Windows PowerShell (JSON formatiert):**

```powershell
(Invoke-WebRequest http://localhost:3000/api/health).Content | ConvertFrom-Json | Select-Object status, app, checks
```

**Erfolgskriterien:**

| Check | Erwartung |
|-------|-----------|
| `checks.database.status` | `ok` |
| `checks.storage.ok` | `true` |
| `checks.migrations.ok` | `true` |
| `app.runtime.production` | `true` wenn `NODE_ENV=production` |
| Studio UI | lädt unter http://localhost:3000 |
| Portal UI | lädt unter http://localhost:3001 |

Bei `status: degraded`: `checks.storage.message` und `checks.migrations.message` lesen — meist fehlende Schreibrechte oder ausstehende Migration.

---

## Schnellstart (Docker — empfohlen)

```bash
git clone <repository-url> uwe
cd uwe
cp .env.example .env
docker compose up -d
```

Beim ersten Start werden Images gebaut und — sofern die Datenbank leer ist — automatisch Demo-Inhalte angelegt (`RUN_DB_SEED=auto`, Standard in `.env.example`).

| App | URL |
|-----|-----|
| UWE Studio | http://localhost:3000 |
| UWE Portal | http://localhost:3001/login |

Demo-Login nach erstem Start: `dm@uwe.local` / `uwe-dev`

**Produktion:** Bearbeiten Sie `.env` vor dem Start:

```env
AUTH_SECRET=<starkes-zufaelliges-geheimnis>   # openssl rand -base64 32
RUN_DB_SEED=false
STUDIO_API_TOKEN=<optional-aber-empfohlen>    # openssl rand -base64 32
```

**Wichtig — Studio absichern:** UWE Studio hat **kein Benutzer-Login**. Betreiben Sie Studio **niemals** direkt öffentlich im Internet. Schützen Sie es mit mindestens einer dieser Maßnahmen:

- Reverse-Proxy mit HTTP-Basic-Auth oder OAuth (z. B. nginx, Caddy, Traefik)
- VPN (Tailscale, WireGuard, …)
- Cloudflare Access oder vergleichbarer Zero-Trust-Zugang

Das Studio-Dashboard und `GET /api/health` zeigen Warnungen, wenn typische Selfhosting-Fehler erkannt werden (fehlendes `AUTH_SECRET`, `RUN_DB_SEED` nicht `false`, fehlendes `STUDIO_API_TOKEN`, aktive öffentliche Portal-/Share-Funktionen).

Prüfen:

```bash
docker compose ps
curl http://localhost:3000/api/health
curl http://localhost:3001/api/health
```

Erwartete Antwort (Auszug):

```json
{
  "status": "ok",
  "app": {
    "name": "UWE Studio",
    "runtime": { "nodeEnv": "production", "production": true }
  },
  "checks": {
    "database": { "status": "ok" },
    "storage": {
      "ok": true,
      "uploadsWritable": true,
      "backupsWritable": true,
      "exportsWritable": true,
      "paths": {
        "dataDir": "...",
        "uploadsDir": "...",
        "backupsDir": "...",
        "exportsDir": "..."
      }
    }
  }
}
```

---

## Build-Prozess

### Mit Docker (Release-Build)

```bash
pnpm docker:build
# oder direkt:
docker compose build
```

Images werden aus dem Multi-Stage-`Dockerfile` gebaut:

1. **deps** — `pnpm install --frozen-lockfile`
2. **builder** — Prisma generate + `pnpm build` (Studio & Portal)
3. **studio / portal** — schlanke Runtime mit Next.js Standalone-Output

Beim Container-Start führt `scripts/docker-entrypoint.sh` automatisch `prisma migrate deploy` aus.

### Manueller Production-Build (ohne Docker)

```bash
pnpm install --frozen-lockfile
pnpm build:release
```

Start der Apps:

```bash
pnpm --filter @uwe/studio start    # Port 3000
pnpm --filter @uwe/portal start    # Port 3001
```

Vor dem ersten Start:

```bash
pnpm db:migrate
```

---

## Persistente Daten & Volumes

| Pfad / Volume | Inhalt | Backup? |
|---------------|--------|---------|
| Docker-Volume `uwe-database` | SQLite-Datenbank (`uwe.db`) | **Ja — kritisch** |
| `./data/uploads` | Hochgeladene Assets (Karten, Sounds, Bilder) | **Ja** |
| `./data/backups` | Von UWE erstellte Backup-ZIPs | Optional (Kopien extern sichern) |
| `./exports` | Statische HTML-Exporte | Optional |

### Docker Compose Volume-Mapping

```yaml
volumes:
  uwe-database:          # SQLite — geteilt von Studio und Portal
  ./data/uploads          # Asset-Dateien
  ./data/backups          # Backup-Ausgabe
  ./exports               # Static-Export-Ausgabe
```

**Wichtig:** Bei Updates oder Neuinstallation diese Pfade **nicht löschen**, sonst gehen Welten, Uploads und Benutzer verloren.

Empfohlene Verzeichnisstruktur nach dem ersten Start:

```
uwe/
  data/
    uploads/     ← Asset-Dateien
    backups/     ← Backup-ZIPs
  exports/       ← Static HTML
  .env           ← lokale Konfiguration (nicht committen)
```

---

## Umgebungsvariablen

Kopieren Sie `.env.example` nach `.env`. Wichtige Variablen:

| Variable | Beschreibung | Produktion |
|----------|--------------|------------|
| `AUTH_SECRET` | Verschlüsselt Spotify-OAuth-Tokens pro Welt (und weitere Geheimnisse) | **Pflicht:** starkes Zufallsgeheimnis (`openssl rand -base64 32`); **stabil halten** nach Spotify-Verbindung |
| `STUDIO_API_TOKEN` | Optionaler Bearer-Token für sensible Studio-APIs | **Empfohlen** bei exponiertem Studio (Backup, Restore, Settings, AI, Export) |
| `SPOTIFY_CLIENT_ID` | Spotify OAuth Client ID (Soundboard, optional) | Nur wenn Spotify-Playback im Studio genutzt wird |
| `SPOTIFY_CLIENT_SECRET` | Spotify OAuth Client Secret | Wie oben |
| `SPOTIFY_REDIRECT_URI` | OAuth-Callback, z. B. `http://localhost:3000/api/spotify/callback` | Muss exakt in der Spotify-App hinterlegt sein |
| `DATABASE_URL` | SQLite-Pfad | Docker: `file:/data/uwe.db` (automatisch) |
| `UPLOADS_DIR` | Upload-Verzeichnis | Docker: `/app/data/uploads` |
| `BACKUPS_DIR` | Backup-Verzeichnis | Docker: `/app/data/backups` |
| `EXPORTS_DIR` | Export-Verzeichnis | Docker: `/app/exports` |
| `UWE_DATA_DIR` | Basis für persistente Daten | z. B. `C:\UWE\data` oder `/var/lib/uwe` |
| `UWE_UPLOADS_DIR` | Uploads (Production) | Überschreibt Default unter `UWE_DATA_DIR` |
| `UWE_BACKUP_DIR` | Backups (Production) | wie oben |
| `UWE_EXPORT_DIR` | Exports (Production) | wie oben |
| `NODE_ENV` | Laufzeitmodus | `production` auf altem Laptop |
| `RUN_DB_SEED` | Demo-Welt beim Start | `auto` (Erststart), **`false` in Produktion** |
| `STUDIO_PORT` / `PORTAL_PORT` | Host-Ports | Nach Bedarf anpassen; Studio nicht ohne Schutz nach außen öffnen |
| `PUBLIC_APP_URL` | Öffentliche HTTPS-URL | z. B. `https://uweandragons.org` |
| `TRUST_PROXY` | X-Forwarded-* Header vertrauen | `true` hinter Cloudflare/Reverse Proxy |
| `CLOUDFLARE_TUNNEL` | Cloudflare-Tunnel-Modus | `true` wenn `cloudflared` vor UWE läuft |
| `AUTH_REQUIRED` | Portal-Login erzwingen | `true` in Production (Standard) |
| `SESSION_COOKIE_SECURE` | Secure-Flag für Session-Cookies | `true` hinter HTTPS |
| `SESSION_COOKIE_SAMESITE` | SameSite für Session-Cookies | `lax` (Standard) |
| `PLAYER_PREVIEW_PUBLIC` | Gast-Wiki ohne Login (`/worlds/*`) | `false` in Production |
| `PLAYER_PREVIEW_REQUIRE_TOKEN` | Share-Links brauchen Passwort | `true` in Production |
| `PLAYER_PREVIEW_ALLOW_DM_ONLY` | DM-only in Preview erlauben | **Immer `false` in Production** |

### Cloudflare Tunnel (alter Laptop)

Cloudflare darf **nur auf UWE** zeigen — niemals auf Ollama, LM Studio oder den RTX-Inference-Endpoint.

```txt
Internet → Cloudflare Tunnel → http://localhost:3000 (Studio)
                              → http://localhost:3001 (Portal)
```

Empfohlene `.env` auf dem alten Laptop:

```env
NODE_ENV=production
PUBLIC_APP_URL=https://uweandragons.org
TRUST_PROXY=true
CLOUDFLARE_TUNNEL=true
AUTH_REQUIRED=true
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_SAMESITE=lax
PLAYER_PREVIEW_PUBLIC=false
PLAYER_PREVIEW_REQUIRE_TOKEN=true
PLAYER_PREVIEW_ALLOW_DM_ONLY=false
STUDIO_API_TOKEN=<openssl rand -base64 32>
AUTH_SECRET=<openssl rand -base64 32>
RUN_DB_SEED=false
```

**Setup-Hinweise (manuell auf dem Host):**

1. `cloudflared tunnel` auf dem alten Laptop installieren
2. Tunnel auf `http://localhost:3000` (Studio) und/oder `http://localhost:3001` (Portal) routen
3. Optional: **Cloudflare Access** vor Studio legen (zusätzlich zu `STUDIO_API_TOKEN`)
4. DNS `uweandragons.org` auf den Tunnel zeigen lassen

**Smoke-Checks nach Tunnel-Start:**

```bash
curl https://uweandragons.org/api/health
# proxy.trustProxy: true, proxy.publicAppUrl gesetzt
# Login unter /login — Session-Cookie mit Secure-Flag
```

Details: `docs/ai-brain-mail/ENV_AND_DEPLOYMENT.md`

### Selfhosting-Sicherheit (Kurzcheckliste)

- [ ] Studio nur im vertrauten Netz oder hinter Reverse-Proxy-Auth/VPN/Cloudflare Access
- [ ] `AUTH_SECRET` gesetzt und nicht der Platzhalter aus `.env.example`
- [ ] `RUN_DB_SEED=false`
- [ ] `STUDIO_API_TOKEN` gesetzt, wenn Studio oder APIs von außen erreichbar sein könnten
- [ ] `PUBLIC_APP_URL`, `TRUST_PROXY` und `SESSION_COOKIE_SECURE` für Cloudflare/HTTPS gesetzt
- [ ] `PLAYER_PREVIEW_ALLOW_DM_ONLY=false`
- [ ] Cloudflare-Tunnel zeigt nur auf UWE — nicht auf RTX/Ollama
- [ ] Öffentliche Portal-/Share-Funktionen in den Einstellungen bewusst geprüft
- [ ] Rate Limiter beachten: prozesslokal — bei mehreren Instanzen zusätzlich am Reverse Proxy limitieren

AI-Provider-Keys (`OPENAI_API_KEY`, etc.) sind optional und nur für UWE Studio relevant.

### Spotify (Studio Soundboard, optional)

Spotify-Playback läuft **nur im Studio** über die Spotify Web API / Spotify Connect — nicht im Spielerportal.

1. Spotify-App im [Developer Dashboard](https://developer.spotify.com/dashboard) anlegen.
2. Redirect-URI eintragen (muss mit `SPOTIFY_REDIRECT_URI` übereinstimmen).
3. `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI` und `AUTH_SECRET` in `.env` setzen.
4. Im Studio pro Welt unter Soundboard verbinden (**Spotify Premium** erforderlich).
5. `AUTH_SECRET` nach dem Verbinden nicht ändern — sonst Tokens neu verbinden.

---

## Healthcheck

Beide Apps stellen `GET /api/health` bereit:

| App | Endpoint | Docker healthcheck |
|-----|----------|-------------------|
| Studio | http://localhost:3000/api/health | alle 30s |
| Portal | http://localhost:3001/api/health | alle 30s, startet nach Studio |

Manuelle Prüfung:

```bash
docker compose ps
docker compose logs studio --tail 50
```

Status `healthy` in `docker compose ps` bestätigt, dass App und Datenbank erreichbar sind.

---

## Backup vor Updates

**Vor jedem Update unbedingt sichern:**

### 1. UWE-Backup (empfohlen)

Über Studio UI unter **Backup** oder per CLI:

```bash
pnpm backup:create
```

Backups landen in `./data/backups/`.

### 2. Manuelles Datei-Backup

```bash
# Datenbank-Volume exportieren
docker compose stop
docker run --rm \
  -v uwe_uwe-database:/data \
  -v $(pwd)/data/backups:/backup \
  alpine tar czf /backup/uwe-db-$(date +%Y%m%d).tar.gz -C /data .

# Uploads und Backups kopieren
tar czf uwe-data-$(date +%Y%m%d).tar.gz data/uploads data/backups exports
docker compose start
```

Ersetzen Sie `uwe_uwe-database` ggf. durch den tatsächlichen Volume-Namen (`docker volume ls`).

---

## Update-Anleitung

1. **Backup erstellen** (siehe oben)
2. Neues Release auschecken oder Images pullen:
   ```bash
   git fetch origin
   git checkout v0.1.0   # oder gewünschte Version
   ```
3. Images neu bauen und Container ersetzen:
   ```bash
   docker compose build
   docker compose up -d
   ```
4. Migrationen laufen beim Start automatisch (`prisma migrate deploy`)
5. Healthchecks prüfen:
   ```bash
   curl -sf http://localhost:3000/api/health
   curl -sf http://localhost:3001/api/health
   ```
6. Release Notes in `CHANGELOG.md` lesen

Bei Problemen: Container-Logs prüfen und ggf. auf Backup zurücksetzen.

---

## Versionierung

- Produktversion steht in `VERSION` und `package.json` (Root)
- API-Health liefert `"version": "0.1.0"` (aus `VERSION`)
- Release-Tags: `v0.1.0`, `v0.2.0`, …

Version prüfen:

```bash
cat VERSION
curl -s http://localhost:3000/api/health | jq .version
```

---

## Troubleshooting

### Container startet nicht / bleibt `unhealthy`

```bash
docker compose logs studio
docker compose logs portal
```

Häufige Ursachen:

- **Datenbank nicht beschreibbar** — Volume-Berechtigungen prüfen
- **Migration fehlgeschlagen** — Logs nach `Prisma migrate failed` durchsuchen
- **Port belegt** — `STUDIO_PORT` / `PORTAL_PORT` in `.env` ändern

### Portal zeigt keine Inhalte

- Seiten müssen **veröffentlicht** (`published`) sein
- Sichtbarkeit muss `public` oder `player_visible` sein
- Spieler brauchen Login und World-Membership

### Uploads fehlen nach Update

- Prüfen, ob `./data/uploads` als Bind-Mount gemappt ist
- Nicht `./data/uploads` beim Update löschen

### Sessions ungültig machen

Portal-Sessions sind opake, datenbankgestützte Tokens (Tabelle `Session`). Sie hängen
**nicht** von `AUTH_SECRET` ab. Um alle Sessions zu invalidieren, leeren Sie die
`Session`-Tabelle (z. B. via `sqlite3 /data/uwe.db "DELETE FROM sessions;"`).

### Manueller DB-Reset (nur Entwicklung!)

```bash
pnpm --filter @uwe/database db:reset
```

**Niemals in Produktion** — löscht alle Daten.

### Build schlägt fehl

```bash
pnpm install --frozen-lockfile
pnpm --filter @uwe/database db:generate
pnpm build
pnpm typecheck
```

---

## Release-Checkliste

Vor einem Release:

- [ ] `pnpm build:release` erfolgreich
- [ ] `pnpm test` erfolgreich
- [ ] `pnpm release:check` erfolgreich
- [ ] `docker compose build` erfolgreich
- [ ] Keine Secrets in Git (`.env` nicht committed)
- [ ] `CHANGELOG.md` aktualisiert
- [ ] `VERSION` und `package.json` synchron

---

## Weitere Dokumentation

- [README.md](../README.md) — Entwicklung und Architektur
- [CHANGELOG.md](../CHANGELOG.md) — Release Notes
- [SECURITY.md](../SECURITY.md) — Sicherheitshinweise
