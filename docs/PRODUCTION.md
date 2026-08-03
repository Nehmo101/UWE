# UWE — Produktion & Release

Anleitung für den produktiven Betrieb von **UWE (Universeller Welten-Editor)** auf
dem aktiven Zielpfad: **Linux Host + `pnpm` + `systemd`**, optional hinter einem
**Cloudflare Tunnel**, mit optionalem **outbound Maschinenraum** für lokale KI.

> Docker und der Windows-One-Click-Installer wurden aus dem aktiven Produktpfad
> entfernt — siehe [removed-legacy-runtime.md](./removed-legacy-runtime.md).
> Detaillierter Host-Setup: [UWE_HOST_LINUX_STARTUP.md](./UWE_HOST_LINUX_STARTUP.md),
> [host-linux.md](./host-linux.md), [deployment.md](./deployment.md),
> Härtung: [deployment-hardening.md](./deployment-hardening.md).

| Komponente | URL (Standard) | Zweck |
|------------|----------------|-------|
| UWE Studio | http://localhost:3000 | DM-Editor (nur für Spielleiter) |
| UWE Portal | http://localhost:3001 | Spieler-Wiki |

---

## Voraussetzungen

- **Node.js** ≥ 22 und **pnpm** ≥ 10
- **Linux** mit `systemd` (Production-Host); macOS/Linux für Entwicklung
- Optional: `cloudflared` (Tunnel), ein Maschinenraum-Rechner für den Host Connector

---

## Production Host (Linux)

UWE läuft dauerhaft auf einem **always-on Linux-Laptop** als zentraler Host
(Datenbank, Uploads, Backups, Exporte, Brain/Mail). Der Maschinenraum-Rechner ist ein
separater **outbound** Inference-Worker — siehe [engine-connector.md](./engine-connector.md).

### Kanonischer Setup-Pfad

```bash
cd /opt/uwe
sudo bash ./deploy/scripts/setup-uwe-host.sh
```

Das Script installiert Node/pnpm/Prisma, baut die Apps, schreibt
`deploy/systemd/uwe.service` nach `/etc/systemd/system/` und startet Studio
(`:3000`) + Portal (`:3001`). Offizielle Pfade: `/etc/uwe/uwe.env`,
`/var/lib/uwe`, Dienst `uwe.service`. Convenience-Wrapper: `pnpm host:start`,
`pnpm host:status`, `pnpm host:stop`.

### Alternative: Manueller Production-Build (Entwicklung/Ad-hoc)

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

Pfade können über **`/etc/uwe/uwe.env`** (Production-Standard) oder optional über
**Studio → Einstellungen → Storage/Backup** gesetzt werden. Studio-Einstellungen
haben Vorrang vor ENV.

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

Legacy-Aliase (`UPLOADS_DIR`, `BACKUPS_DIR`, `EXPORTS_DIR`) funktionieren weiterhin
— siehe `.env.example`.

**Wichtig:** Diese Verzeichnisse beim Update **nicht löschen**. Vor Updates immer
Backup erstellen.

### Erster Owner (Produktion ohne Demo-Seed)

1. `UWE_SETUP_TOKEN` in `uwe.env` setzen und Dienst neu starten
   (`sudo systemctl restart uwe.service`)
2. Studio öffnen: http://localhost:3000/setup (kein `Authorization`-Header nötig,
   auch wenn `STUDIO_API_TOKEN` gesetzt ist)
3. Owner-Konto anlegen (Setup ist danach dauerhaft deaktiviert; `/setup` leitet zur
   Anmeldung um)
4. Optional: SMTP konfigurieren für Passwort-Reset-Mails (`SMTP_HOST`, `MAIL_ENABLED=true`)

**Studio absichern:** UWE Studio hat **Session-Login** (owner/admin/dm) plus
optionale äußere Schutzschichten. Betreiben Sie Studio **niemals** ohne
zusätzliche Absicherung direkt öffentlich im Internet:

- Cloudflare Access oder vergleichbarer Zero-Trust-Zugang (empfohlene äußere Schicht)
- Reverse-Proxy mit HTTP-Basic-Auth oder OAuth (nginx, Caddy, Traefik)
- VPN (Tailscale, WireGuard, …)
- `STUDIO_API_TOKEN` für API-Härtung

Das Studio-Dashboard und `GET /api/health` zeigen Warnungen, wenn typische
Selfhosting-Fehler erkannt werden (fehlendes `AUTH_SECRET`, `RUN_DB_SEED` nicht
`false`, fehlendes `STUDIO_API_TOKEN`, aktive öffentliche Portal-/Share-Funktionen).

---

## Smoke-Checks nach Start

Nach jedem Erststart, Update oder Neustart:

```bash
# 1. Healthchecks (Studio + Portal)
curl -sf http://localhost:3000/api/health
curl -sf http://localhost:3001/api/health

# 2. systemd-Status + Logs
systemctl status uwe.service
journalctl -u uwe.service --no-pager -n 50
```

Erwartete Antwort (Auszug):

```json
{
  "status": "ok",
  "app": { "name": "UWE Studio", "runtime": { "nodeEnv": "production", "production": true } },
  "checks": {
    "database": { "status": "ok" },
    "storage": {
      "ok": true,
      "uploadsWritable": true,
      "backupsWritable": true,
      "exportsWritable": true,
      "paths": { "dataDir": "...", "uploadsDir": "...", "backupsDir": "...", "exportsDir": "..." }
    }
  }
}
```

**Erfolgskriterien:**

| Check | Erwartung |
|-------|-----------|
| `checks.database.status` | `ok` |
| `checks.storage.ok` | `true` |
| `checks.migrations.ok` | `true` |
| `app.runtime.production` | `true` wenn `NODE_ENV=production` |
| `trust.runDbSeedDisabled` | `true` (`RUN_DB_SEED=false`) |
| `trust.authSecretLooksWeak` | `false` |
| Studio UI | lädt unter http://localhost:3000 |
| Portal UI | lädt unter http://localhost:3001 |

Bei `status: degraded`: `checks.storage.message` und `checks.migrations.message`
lesen — meist fehlende Schreibrechte oder ausstehende Migration.

---

## Build-Prozess

```bash
pnpm install --frozen-lockfile
pnpm build:release   # db:generate + Build (Studio & Portal) + standalone-check
```

Auf dem Host übernimmt `deploy/scripts/setup-uwe-host.sh` Install, Build und
`prisma migrate deploy`. Apps starten über `deploy/scripts/start-uwe.sh` (von
`uwe.service` aufgerufen) bzw. manuell:

```bash
pnpm db:migrate                    # vor dem ersten Start
pnpm --filter @uwe/studio start    # Port 3000
pnpm --filter @uwe/portal start    # Port 3001
```

---

## Persistente Daten

| Pfad | Inhalt | Backup? |
|------|--------|---------|
| `/var/lib/uwe/uwe.db` | SQLite-Datenbank (geteilt von Studio und Portal) | **Ja — kritisch** |
| `/var/lib/uwe/uploads` | Hochgeladene Assets (Karten, Sounds, Bilder) | **Ja** |
| `/var/lib/uwe/backups` | Von UWE erstellte Backup-ZIPs | Optional (Kopien extern sichern) |
| `/var/lib/uwe/exports` | Statische HTML-Exporte | Optional |

**Wichtig:** Diese Pfade bei Updates **nicht löschen**, sonst gehen Welten,
Uploads und Benutzer verloren.

---

## Umgebungsvariablen

Kopieren Sie `.env.example` nach `.env` (Dev) bzw. pflegen Sie `/etc/uwe/uwe.env`
(Host). Wichtige Variablen:

| Variable | Beschreibung | Produktion |
|----------|--------------|------------|
| `AUTH_SECRET` | Verschlüsselt Spotify-OAuth-Tokens pro Welt (und weitere Geheimnisse) | **Pflicht:** starkes Zufallsgeheimnis (`openssl rand -base64 32`); **stabil halten** nach Spotify-Verbindung |
| `STUDIO_API_TOKEN` | Optionaler Bearer-Token für sensible Studio-APIs | **Empfohlen** bei exponiertem Studio (Backup, Restore, Settings, AI, Export) |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | Spotify OAuth (Soundboard, optional) | Nur wenn Spotify-Playback genutzt wird |
| `SPOTIFY_REDIRECT_URI` | OAuth-Callback, z. B. `http://localhost:3000/api/spotify/callback` | Muss exakt in der Spotify-App hinterlegt sein |
| `DATABASE_URL` | SQLite-Pfad | z. B. `file:/var/lib/uwe/uwe.db` |
| `UWE_DATA_DIR` | Basis für persistente Daten | z. B. `/var/lib/uwe` |
| `UWE_UPLOADS_DIR` / `UWE_BACKUP_DIR` / `UWE_EXPORT_DIR` | Uploads / Backups / Exporte (Production) | Überschreiben Defaults unter `UWE_DATA_DIR` |
| `NODE_ENV` | Laufzeitmodus | `production` auf dem Host |
| `RUN_DB_SEED` | Demo-Welt beim Start | `auto` (Erststart), **`false` in Produktion** |
| `STUDIO_PORT` / `PORTAL_PORT` | Host-Ports | Nach Bedarf; Studio nicht ungeschützt nach außen öffnen |
| `PUBLIC_APP_URL` | Öffentliche HTTPS-URL | z. B. `https://uwe.example` |
| `TRUST_PROXY` | X-Forwarded-* Header vertrauen | `true` hinter Cloudflare/Reverse Proxy |
| `CLOUDFLARE_TUNNEL` | Cloudflare-Tunnel-Modus | `true` wenn `cloudflared` vor UWE läuft |
| `STUDIO_PATH` / `PORTAL_PATH` | Subpath-Routing (`/studio`, `/portal`) | Bevorzugt gegenüber vielen Subdomains |
| `AUTH_REQUIRED` | Portal-Login erzwingen | `true` in Production (Standard) |
| `SESSION_COOKIE_SECURE` | Secure-Flag für Session-Cookies | `true` hinter HTTPS |
| `SESSION_COOKIE_SAMESITE` | SameSite für Session-Cookies | `lax` (Standard) |
| `PLAYER_PREVIEW_PUBLIC` | Gast-Wiki ohne Login (`/worlds/*`) | `false` in Production |
| `PLAYER_PREVIEW_REQUIRE_TOKEN` | Share-Links brauchen Passwort | `true` in Production |
| `PLAYER_PREVIEW_ALLOW_DM_ONLY` | DM-only in Preview erlauben | **Immer `false` in Production** |

Vollständige Liste inkl. Brain/Inferenz/Connector: `.env.example` und
`tools/uwe-engine-connector/.env.example`.

### Cloudflare Tunnel

Cloudflare darf **nur auf UWE** zeigen — niemals auf Ollama, LM Studio oder einen
Maschinenraum-Inference-Endpoint. Der Maschinenraum verbindet sich ohnehin **outbound**
und braucht keinen eingehenden Port.

**Daily Admin OS / Life-Brain:** Persönliches Life-Brain und DnD-Brain dürfen nur
über lokale Maschinenraum-Inference verarbeitet werden — Cloud-KI erhält keinen lokalen
Kontext. Maschinenraum offline → Jobs werden vorgemerkt, kein Cloud-Fallback. Details:
[life-brain-privacy.md](./life-brain-privacy.md), Admin-Status unter `/admin/status`.

```txt
Internet → Cloudflare Tunnel → http://localhost:3000 (Studio)
                              → http://localhost:3001 (Portal)
```

Empfohlene Host-`.env`:

```env
NODE_ENV=production
PUBLIC_APP_URL=https://uwe.example
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

Setup: `cloudflared tunnel` auf dem Host installieren, Tunnel auf `:3000`/`:3001`
routen, optional **Cloudflare Access** vor Studio legen, DNS auf den Tunnel zeigen.
Beispiel-Konfiguration: `deploy/cloudflare/`.

---

## Healthcheck

Beide Apps stellen `GET /api/health` bereit:

| App | Endpoint |
|-----|----------|
| Studio | http://localhost:3000/api/health |
| Portal | http://localhost:3001/api/health |

```bash
curl -sf http://localhost:3000/api/health
journalctl -u uwe.service --no-pager -n 50
```

`status: ok` bestätigt, dass App und Datenbank erreichbar sind.

---

## Backup vor Updates

**Vor jedem Update sichern.**

### 1. UWE-Backup (empfohlen)

Über Studio UI unter **Backup** oder per CLI:

```bash
pnpm backup:create
```

Auf dem Host läuft das Backup automatisch über `deploy/systemd/uwe-backup.timer`
(Script `deploy/scripts/uwe-backup.sh`). Backups landen unter `/var/lib/uwe/backups`.

### 2. Manuelles Datei-Backup

```bash
sudo systemctl stop uwe.service
sudo tar czf /var/lib/uwe/backups/uwe-data-$(date +%Y%m%d).tar.gz \
  -C /var/lib/uwe uwe.db uploads exports
sudo systemctl start uwe.service
```

---

## Update-Anleitung

Auf dem Host aktualisiert `setup-uwe-host.sh --quick` (bzw.
`deploy/scripts/uwe-host-update.sh`) per `git pull` + Rebuild, behält Daten und
`uwe.env`.

1. **Backup erstellen** (siehe oben)
2. Update ziehen und anwenden:
   ```bash
   cd /opt/uwe
   sudo bash ./deploy/scripts/setup-uwe-host.sh --quick
   ```
3. Migrationen laufen beim Setup automatisch (`prisma migrate deploy`)
4. Healthchecks prüfen:
   ```bash
   curl -sf http://localhost:3000/api/health
   curl -sf http://localhost:3001/api/health
   ```
5. Release Notes in `CHANGELOG.md` lesen

Bei Problemen: `journalctl -u uwe.service` prüfen und ggf. auf Backup zurücksetzen.

---

## Versionierung

- Produktversion steht in `VERSION` und `package.json` (Root)
- API-Health liefert `"version"` aus `VERSION`
- Release-Tags: `v0.1.0`, `v0.2.0`, …

```bash
cat VERSION
curl -s http://localhost:3000/api/health | jq .version
```

---

## Troubleshooting

### Dienst startet nicht / bleibt fehlerhaft

```bash
systemctl status uwe.service
journalctl -u uwe.service --no-pager -n 100
```

Häufige Ursachen:

- **Datenbank nicht beschreibbar** — Rechte auf `/var/lib/uwe` prüfen (`uwe:uwe`)
- **Migration fehlgeschlagen** — Logs nach `Prisma migrate failed` durchsuchen
- **Port belegt** — `STUDIO_PORT` / `PORTAL_PORT` in `uwe.env` ändern
- **Node nicht gefunden** — `setup-uwe-host.sh --repair` ausführen

### Portal zeigt keine Inhalte

- Seiten müssen **veröffentlicht** (`published`) sein
- Sichtbarkeit muss `public` oder `player_visible` sein
- Spieler brauchen Login und World-Membership

### Sessions invalidieren

Portal-Sessions sind opake, datenbankgestützte Tokens (Tabelle `Session`) und
hängen **nicht** von `AUTH_SECRET` ab. Zum Invalidieren die `sessions`-Tabelle
leeren (z. B. `sqlite3 /var/lib/uwe/uwe.db "DELETE FROM sessions;"`).

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
- [ ] Keine Secrets in Git (`.env` nicht committed)
- [ ] `CHANGELOG.md` aktualisiert
- [ ] `VERSION` und `package.json` synchron
