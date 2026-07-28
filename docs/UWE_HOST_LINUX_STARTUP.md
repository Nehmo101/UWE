# UWE auf Linux — Production Host (systemd)

Offizielle Anleitung für den **UWE Production Host** unter Linux (Ubuntu, Debian und Fedora 44).

UWE besteht aus zwei Web-Apps:

| App | Standard-Port | Zweck |
|-----|---------------|-------|
| **Studio** | 3000 | Spielleiter-Editor (DM) |
| **Portal** | 3001 | Spieler-Wiki |

Nach dem Setup sind beide im **Heimnetz** erreichbar (`HOST=0.0.0.0`).

---

## Offizielle Pfade

| Pfad | Inhalt |
|------|--------|
| `/opt/uwe` | Git-Repository |
| `/etc/uwe/uwe.env` | **Einzige** produktive Env-Datei (Secrets, DB-Pfad) |
| `/var/lib/uwe` | SQLite-Datenbank, Uploads, Exports |
| `/var/log/uwe` | Anwendungslogs |
| `/var/backups/uwe` | Backups |
| `uwe.service` | Offizieller Studio-/Portal-Dienst |
| `uwe-rtx-connector.service` | Optionaler outbound RTX Connector; nur mit gültiger Connector-`.env` aktiviert |

Es gibt **keinen** parallelen Legacy-Flow mehr (`uwe-host.service`, `.uwe-host`, repo-lokale `.env` für Production).

---

## Kurzüberblick

| Situation | Befehl |
|-----------|--------|
| Erstinstallation / Update | `sudo bash ./deploy/scripts/setup-uwe-host.sh` |
| Schnelles Update nach `git pull` | `sudo bash ./deploy/scripts/setup-uwe-host.sh --quick` |
| Gründliche Reparatur | `sudo bash ./deploy/scripts/setup-uwe-host.sh --repair` |
| Status (read-only) | `sudo bash ./deploy/scripts/setup-uwe-host.sh --healthcheck` |
| Kompletter Reset (destruktiv) | `sudo bash ./deploy/scripts/setup-uwe-host.sh --fresh` |
| Service starten | `sudo systemctl start uwe` |
| Service stoppen | `sudo systemctl stop uwe` |
| Service-Status | `sudo systemctl status uwe --no-pager` |
| Convenience (ohne sudo) | `pnpm host:start` / `host:stop` / `host:status` |

Alle Befehle im Repository unter `/opt/uwe` (oder Ihrem Klone) ausführen.

---

## Erstinstallation

### Voraussetzungen

| Voraussetzung | Hinweis |
|---------------|---------|
| Linux mit systemd | Ubuntu 22.04/24.04, Debian 12 oder Fedora 44 |
| Node.js 22 | Wird vom Setup-Script automatisch installiert (systemweit unter `/usr/bin/node`) |
| git, curl, apt/dnf | Werden vom Setup-Script passend zu `/etc/os-release` installiert |
| root/sudo | Setup-Script muss als root laufen |

**Sie müssen Node, pnpm, Prisma oder systemd nicht manuell installieren.** Ein Befehl reicht:

```bash
sudo bash ./deploy/scripts/setup-uwe-host.sh
```

### Fedora 44

Auf Fedora verwendet das Setup ausschließlich `dnf` und die versionierten
Fedora-Pakete für Node.js 22. Firewalld-Regeln für `3000/tcp` und `3001/tcp`
werden in der aktiven Standardzone sofort und permanent gesetzt. Das Setup
aktiviert Firewalld nicht ungefragt; auf einem Minimal-System daher vorher:

```bash
sudo systemctl enable --now firewalld
sudo bash ./deploy/scripts/setup-uwe-host.sh
```

SELinux bleibt **Enforcing**. Das Setup führt `restorecon` für die UWE-Pfade aus;
SELinux nicht deaktivieren. Bei einer echten AVC-Blockade zuerst
`sudo ausearch -m AVC -ts recent` prüfen und nur eine eng begrenzte lokale Policy
erstellen.

`dnf5-plugins` und `dnf5-plugin-automatic` werden mitinstalliert. Automatische
Updates werden nicht ungefragt aktiviert. In `/etc/dnf/automatic.conf` mindestens
`apply_updates = True` setzen (optional `upgrade_type = security`) und danach den
Timer mit `sudo systemctl enable --now dnf5-automatic.timer` aktivieren. Das Host
Command Center prüft sowohl den Timer als auch `apply_updates`.

### Einmaliger Befehl

```bash
sudo mkdir -p /opt
sudo git clone https://github.com/nehmo101/uwe /opt/uwe
cd /opt/uwe
sudo bash ./deploy/scripts/setup-uwe-host.sh
```

Das Script ist **idempotent** — kann beliebig oft ausgeführt werden, ohne Daten oder Secrets zu löschen.

### Erstes Owner-Setup

1. Secrets in `/etc/uwe/uwe.env` prüfen (werden bei fehlenden Werten automatisch ergänzt):

   ```bash
   sudo nano /etc/uwe/uwe.env
   # AUTH_SECRET, UWE_SETUP_TOKEN, STUDIO_API_TOKEN
   sudo systemctl restart uwe
   ```

2. Browser: **`http://127.0.0.1:3000/setup`** — Setup-Token aus `UWE_SETUP_TOKEN` eingeben, Owner anlegen.

3. Nach erfolgreichem Setup leitet `/setup` zur Anmeldung um.

`/setup` ist **ohne** Studio-API-Bearer-Token erreichbar, solange noch kein Master-Admin existiert. Danach sind Studio-/Admin-APIs weiterhin geschützt.

---

## Nach Git-Pull aktualisieren

```bash
cd /opt/uwe
git pull
sudo bash ./deploy/scripts/setup-uwe-host.sh --quick
```

Oder ohne `--quick` (konservatives Update, schreibt systemd-Unit neu):

```bash
sudo bash ./deploy/scripts/setup-uwe-host.sh
```

### Update aus dem Studio (Owner)

Auf dem Linux-Production-Host kann der **Owner** das gleiche Update auch unter **Hardware / Homelab → UWE Host-Update** auslösen.

Voraussetzungen:

1. `UWE_HOST_UPDATE_ENABLED=true` in `/etc/uwe/uwe.env`
2. Einmalig: `sudo bash ./deploy/scripts/setup-uwe-host.sh` (installiert `uwe-host-update.service` und sudoers-Regel)
3. Owner-Session im Studio (kein API-Token)

Der Button führt asynchron `git pull` und `setup-uwe-host.sh --quick` aus. Fortschritt: `/var/log/uwe/host-update.log` und die UI auf `/hardware`.

---

## Preflight / Dependency Doctor

Jeder Setup-Lauf beginnt mit einer **Preflight-Phase**. Das Script prüft und protokolliert u. a.:

- Betriebssystem, Architektur, User, Root-Status
- Repository-Pfad, Git-Branch, letzter Commit
- Disk Space, RAM, DNS (GitHub, npm und die distributionsspezifische Paketquelle)
- apt/dnf, curl, ca-certificates, GnuPG, git, Firewalld/UFW und SELinux
- node/npm/pnpm/corepack/systemd
- `/etc/uwe/uwe.env`, `/opt/uwe`

Ausgabeformat:

```
[OK]   …
[FIX]  …  (wird im selben Lauf behoben)
[WARN] …
[FAIL] …
```

Fehlende Dependencies werden **automatisch installiert** — ohne nvm, ohne `.bashrc`, ohne interaktive Shell. Node.js 22 landet systemweit unter `/usr/bin/node` (NodeSource, kein blindes `curl | bash`).

Bei NodeSource-Fehlern bricht das Script **vor** dem Service-Start ab und gibt Diagnose aus (OS, Architektur, `apt-cache policy nodejs`, apt-Logs, NodeSource-Erreichbarkeit).

---

## Setup-Modi

### Default (ohne Flag)

- Preflight + automatische Dependency-Reparatur (Node/pnpm nur wenn nötig)
- Sicherer, wiederholbarer Update-/Repair-Lauf
- Ergänzt fehlende Env-Variablen, **überschreibt keine** bestehenden Secrets
- Keine destruktiven Aktionen
- Schreibt `uwe.service` neu (idempotent)
- Prisma über Workspace: `pnpm --filter @uwe/database db:generate` / `db:deploy`
- Standalone-Prisma-Runtime-Check vor Service-Start

### `--quick`

- Preflight, dann schneller Update-Lauf nach `git pull`
- **Kein** NodeSource-Neuaufbau, außer Node fehlt oder ist nicht v22.x
- `pnpm install` nur wenn Lockfile/package geändert oder `node_modules` fehlt
- Prisma generate/deploy, Build, Restart, Healthcheck

### `--repair`

- Gründlicher Dependency-Repair: Node.js 22 + pnpm/corepack neu
- Entfernt `node_modules` und Build-Caches
- Standalone-Checks, systemd-Repair, Restart, Healthcheck
- **Löscht keine** Datenbank, Uploads oder Secrets

### `--fresh` / `--wipe-and-reinstall`

- **Destruktiv** — nur mit Bestätigung `DELETE-UWE`
- Legt vor dem Löschen Backup unter `/var/backups/uwe/<timestamp>-pre-fresh/` an
- Entfernt `/var/lib/uwe` und `/etc/uwe/uwe.env`, setzt neu auf

### `--healthcheck`

- Verändert nichts (read-only)
- Checkliste: node/npm/pnpm, systemd, Ports 3000/3001, `/api/health`, `/setup`, Standalone-Module
- Gibt lokale und LAN-URLs aus

---

## Node.js 22, pnpm und Prisma (automatisch)

| Komponente | Verhalten |
|------------|-----------|
| **Node.js 22** | NodeSource-Repo (manuell konfiguriert, validiert), Ziel: `/usr/bin/node` |
| **pnpm** | Version aus `packageManager` in root `package.json` (z. B. `pnpm@10.12.1`) via corepack; Fallback: `npm install -g pnpm` |
| **Prisma** | Immer workspace-sicher vom Repo-Root: `pnpm --filter @uwe/database db:generate` und `db:deploy` |
| **systemd PATH** | `Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin` |
| **Restart-Limit** | `StartLimitIntervalSec=300`, `StartLimitBurst=5`, `RestartSec=5` — verhindert tausende Restart-Schleifen |

---

## Optionale AI-Diagnose

Bei Setup-Fehlern kann optional eine OpenAI/Cursor-kompatible API Logs zusammenfassen. **Standard: deaktiviert** — die Installation hängt nicht davon ab.

| Variable | Bedeutung |
|----------|-----------|
| `UWE_AI_DIAG_ENABLED=1` | AI-Diagnose aktivieren (non-interaktiv) |
| `UWE_AI_DIAG_PROVIDER=openai` | Provider |
| `UWE_AI_DIAG_API_KEY=…` | API-Key (niemals loggen) |
| `UWE_AI_DIAG_MODEL=gpt-4o-mini` | Modell |

Interaktiv: Bei Fehlern fragt das Script nach Zustimmung und API-Key.

**Niemals gesendet:** vollständige `/etc/uwe/uwe.env`, `DATABASE_URL`, Secrets, Tokens, Passwörter, API-Keys. Logs werden vor dem Senden geschwärzt.

Reports optional unter `/var/log/uwe/diagnostics/<timestamp>.md`.

Implementierung: `deploy/scripts/lib/uwe-host-ai-diagnostics.sh`

---

## Autostart nach Neustart

`setup-uwe-host.sh` aktiviert `uwe.service` automatisch (`systemctl enable`). Die
optionale `uwe-rtx-connector.service` wird installiert, aber erst bei einer gültig
konfigurierten `tools/uwe-rtx-connector/.env` aktiviert und gestartet.

Nach Reboot prüfen:

```bash
sudo systemctl status uwe --no-pager
pnpm host:status
```

Autostart deaktivieren (Daten bleiben erhalten):

```bash
pnpm host:uninstall-autostart
# oder: sudo systemctl disable uwe
```

---

## Convenience-Scripts (`pnpm host:*`)

Die `host:*`-Scripts leiten auf den Production-Flow um — sie starten **keinen** parallelen Legacy-Prozess mehr.

| Script | Verhalten |
|--------|-----------|
| `pnpm host:start` | `sudo systemctl start uwe` |
| `pnpm host:stop` | `sudo systemctl stop uwe` |
| `pnpm host:status` | `systemctl status uwe` + Erreichbarkeit |
| `pnpm host:install-autostart` | Ruft `setup-uwe-host.sh` auf |
| `pnpm host:uninstall-autostart` | `systemctl disable uwe` (keine Datenlöschung) |

---

## Fehlerbehebung

### `Cannot find module '@prisma/adapter-libsql'` oder `@libsql/core/config` (HTTP 500 auf `/api/health` oder `/setup`)

Der Next.js-Standalone-Output enthält nicht alle Prisma/LibSQL-Runtime-Dependencies. Typisch nach Build ohne Post-Build-Materialize oder wenn pnpm-Symlinks beim Kopieren dereferenziert wurden (`cp -rL`).

**Symptome:** `journalctl -u uwe` zeigt `Error: Cannot find module '@prisma/adapter-libsql'` oder `Cannot find module '@libsql/core/config'`, Studio antwortet mit HTTP 500.

**Reparatur:**

```bash
cd /opt/uwe
git pull
sudo bash ./deploy/scripts/setup-uwe-host.sh --repair
```

Das Setup-Script prüft jetzt per `require()` (nicht nur `resolve()`), ob `@prisma/adapter-libsql` und `@libsql/client` wirklich ladbar sind, und kopiert `.next/static` in den Standalone-Output.

**Manuelle Prüfung nach Build:**

```bash
cd /opt/uwe/apps/studio/.next/standalone
node -e "console.log(require.resolve('@prisma/adapter-libsql'))"
node -e "console.log(require.resolve('@prisma/adapter-pg'))"
node -e "console.log(require.resolve('@prisma/client'))"
node -e "console.log(require.resolve('@libsql/client'))"
node -e "console.log(require.resolve('pg'))"
```

Gleiche Checks für Portal unter `apps/portal/.next/standalone`. Das Setup-Script bricht ab, wenn diese Module fehlen — statt einen kaputten Service zu starten.

### `exec: node: not found` (Service exit 127)

systemd lädt keine interaktive Shell — `node` muss im systemd-PATH liegen (typisch `/usr/bin/node` via NodeSource).

**Symptome:** `journalctl -u uwe` zeigt `Node.js not found in systemd PATH` oder `exec: node: not found`.

**Reparatur (ein Befehl):**

```bash
sudo bash ./deploy/scripts/setup-uwe-host.sh --repair
```

Das Script installiert Node.js 22 systemweit, setzt `Environment=PATH=…` in `uwe.service`, begrenzt Restart-Schleifen und validiert vor dem Start.

### systemd Restart-Schleife (tausende Restarts)

`uwe.service` setzt jetzt explizit:

```
StartLimitIntervalSec=300
StartLimitBurst=5
RestartSec=5
```

Nach 5 Fehlstarts in 5 Minuten stoppt systemd den Dienst. Ursache beheben (`--repair`), dann:

```bash
sudo systemctl reset-failed uwe
sudo bash ./deploy/scripts/setup-uwe-host.sh --repair
```

### `Prisma command not found` oder falsches Schema

Prisma-Befehle immer über das Workspace-Paket ausführen (vom Repo-Root `/opt/uwe`):

```bash
pnpm --filter @uwe/database db:generate
pnpm --filter @uwe/database db:deploy
```

Nicht verwenden: `pnpm exec prisma … --schema ./packages/database/prisma/schema.prisma` (fragiler Pfad).

### HTTP 500 auf `/api/health` oder `/setup`

1. Logs prüfen: `journalctl -u uwe -n 80 --no-pager`
2. Standalone-Module prüfen (siehe oben)
3. Node/PATH prüfen: `command -v node && node --version`
4. Repair: `sudo bash ./deploy/scripts/setup-uwe-host.sh --repair`

### systemd PATH Probleme

`uwe.service` lädt zuerst `/etc/uwe/uwe.env` und setzt danach explizit:

```
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
Environment=NODE_BIN=/usr/bin/node
```

So kann ein versehentliches `PATH=` in `uwe.env` (z. B. von nvm) den Dienst nicht mehr kaputt machen. Das Setup-Script entfernt `PATH=` aus `/etc/uwe/uwe.env` automatisch.

`start-uwe.sh` prüft vor dem Start `command -v node`, fällt auf `/usr/bin/node` zurück und bricht mit klarer Meldung ab:

```
Node.js not found in systemd PATH. Run: sudo bash /opt/uwe/deploy/scripts/setup-uwe-host.sh --repair
```

### Standalone Output fehlt Dependencies

Nach `pnpm build` materialisiert `scripts/materialize-standalone-prisma-deps.mjs` die Prisma-Runtime in den Standalone-`node_modules` (wie im Docker-Image). Validierung:

```bash
pnpm build:standalone-check
# oder einzeln:
node scripts/check-standalone-prisma-deps.mjs studio
node scripts/check-standalone-prisma-deps.mjs portal
```

### Service läuft nicht

```bash
sudo systemctl status uwe --no-pager
journalctl -u uwe -n 80 --no-pager
sudo bash ./deploy/scripts/setup-uwe-host.sh --repair
```

### Port 3000 nicht offen

```bash
ss -ltnp | grep 3000
sudo systemctl restart uwe
```

### App hört nur auf 127.0.0.1 statt 0.0.0.0

In `/etc/uwe/uwe.env` prüfen:

```
HOST=0.0.0.0
HOSTNAME=0.0.0.0
```

Dann `sudo systemctl restart uwe` und `ss -ltnp | grep 3000` — erwartet `0.0.0.0:3000`.

### `/setup` zeigt „Studio-API-Token erforderlich“

Das sollte **vor** abgeschlossenem Owner-Setup nicht passieren. Prüfen:

```bash
curl -s http://127.0.0.1:3000/api/auth/setup
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/setup
```

Falls blockiert: `STUDIO_API_TOKEN` in `/etc/uwe/uwe.env` setzen und Service neu starten. `/setup` bleibt ohne Bearer-Token erreichbar, solange kein Owner existiert.

### Zugriff vom anderen PC im LAN klappt nicht

1. Gleiches WLAN?
2. Firewall: `sudo ufw allow 3000/tcp && sudo ufw allow 3001/tcp`
3. Lauscht auf `0.0.0.0`? (siehe oben)
4. IP am **Host** prüfen: `hostname -I`

### Unterschied Setup / Quick / Repair / Fresh

| Modus | Node-Reinstall | Cache-Löschung | Daten/Secrets | systemd neu |
|-------|----------------|----------------|---------------|-------------|
| default | nein | nein | behalten | ja |
| `--quick` | nein | nein | behalten | nur wenn fehlt |
| `--repair` | ja | ja (node_modules) | behalten | ja |
| `--fresh` | ja | ja | **gelöscht** | ja |

### Legacy `uwe-host.service` noch aktiv

```bash
sudo systemctl stop uwe-host
sudo systemctl disable uwe-host
sudo bash ./deploy/scripts/setup-uwe-host.sh
```

Das Setup-Script migriert automatisch von `uwe-host.service` zu `uwe.service`.

---

## Logs

```bash
journalctl -u uwe -f
journalctl -u uwe -n 100 --no-pager
```

Datei-Logs (falls konfiguriert): `/var/log/uwe/`

---

## Sicherheit

- UWE lauscht auf **0.0.0.0** — erreichbar im **Heimnetz**
- **Nicht** ohne Schutz ins Internet stellen
- Für öffentlichen Zugriff: Cloudflare Tunnel + Access — siehe [deployment-hardening.md](./deployment-hardening.md)
- Secrets nur in `/etc/uwe/uwe.env` — nie ins Git committen
- Normale Setup-Läufe löschen **niemals** Daten oder Secrets
- Fedora: SELinux bleibt aktiv; Firewalld-Regeln werden runtime + permanent gesetzt

---

## Technische Referenz

| Datei | Zweck |
|-------|-------|
| `deploy/scripts/setup-uwe-host.sh` | Offizieller Einstiegspunkt (Setup/Update/Repair) |
| `deploy/scripts/lib/uwe-host-preflight.sh` | Preflight/Doctor-Checks |
| `deploy/scripts/lib/uwe-host-platform.sh` | OS-, apt/dnf-, Firewalld/UFW- und SELinux-Abstraktion |
| `deploy/scripts/lib/uwe-host-deps.sh` | Node/pnpm/Prisma/Build-Dependencies |
| `deploy/scripts/lib/uwe-host-ai-diagnostics.sh` | Optionale AI-Fehleranalyse |
| `deploy/scripts/start-uwe.sh` | Startet Studio + Portal (von systemd aufgerufen) |
| `deploy/systemd/uwe.service` | Referenz-Unit (wird vom Setup-Script nach `/etc/systemd/system/` geschrieben) |
| `deploy/systemd/uwe-rtx-connector.service` | Optionale outbound Connector-Unit |
| `scripts/uwe-host-*.sh` | Convenience-Wrapper um `uwe.service` |

Weitere Production-Hinweise: [PRODUCTION.md](./PRODUCTION.md). Der aktive Pfad ist Linux Host + `systemd` (kein Docker, kein Windows-Installer) — siehe [removed-legacy-runtime.md](./removed-legacy-runtime.md).
