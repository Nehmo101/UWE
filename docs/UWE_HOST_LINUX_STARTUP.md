# UWE auf Linux — Production Host (systemd)

Offizielle Anleitung für den **UWE Production Host** unter Linux (Ubuntu, Debian, Lubuntu, …).

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
| `uwe.service` | **Einziger** offizieller systemd-Dienst |

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
| Linux mit systemd | Ubuntu 22.04/24.04 oder Debian 12 empfohlen |
| Node.js 22 | Wird bei `--repair` / Erstsetup installiert (Projekt unterstützt ≥ 20) |
| git | Repository unter `/opt/uwe` |
| root/sudo | Setup-Script muss als root laufen |

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

---

## Setup-Modi

### Default (ohne Flag)

- Sicherer, wiederholbarer Update-/Repair-Lauf
- Ergänzt fehlende Env-Variablen, **überschreibt keine** bestehenden Secrets
- Keine destruktiven Aktionen
- Schreibt `uwe.service` neu (idempotent)

### `--quick`

- Schneller Update-Lauf nach `git pull`
- Kein Node-Reinstall, kein aggressives Cache-Löschen
- Git-Status-Warnung, `pnpm install`, Prisma generate/migrate, Build, Service-Restart

### `--repair`

- Validiert/repariert Node.js 22, pnpm, corepack
- Entfernt `node_modules` und Build-Caches, saubere Neuinstallation
- Schreibt systemd-Unit neu
- **Löscht keine** Datenbank, Uploads oder Secrets

### `--fresh` / `--wipe-and-reinstall`

- **Destruktiv** — nur mit Bestätigung `DELETE-UWE`
- Legt vor dem Löschen Backup unter `/var/backups/uwe/<timestamp>-pre-fresh/` an
- Entfernt `/var/lib/uwe` und `/etc/uwe/uwe.env`, setzt neu auf

### `--healthcheck`

- Verändert nichts
- Prüft: `systemctl status uwe`, Ports, `curl` auf `/`, `/setup`, `/api/health`
- Gibt lokale und LAN-URLs aus

---

## Autostart nach Neustart

`setup-uwe-host.sh` aktiviert `uwe.service` automatisch (`systemctl enable`).

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

---

## Technische Referenz

| Datei | Zweck |
|-------|-------|
| `deploy/scripts/setup-uwe-host.sh` | Offizieller Einstiegspunkt (Setup/Update/Repair) |
| `deploy/scripts/start-uwe.sh` | Startet Studio + Portal (von systemd aufgerufen) |
| `deploy/systemd/uwe.service` | Referenz-Unit (wird vom Setup-Script nach `/etc/systemd/system/` geschrieben) |
| `deploy/linux/uwe-host.service` | **Deprecated** — nur noch für Migration dokumentiert |
| `scripts/uwe-host-*.sh` | Convenience-Wrapper um `uwe.service` |

Weitere Production-Optionen: [PRODUCTION.md](./PRODUCTION.md), Docker: `docker compose up -d`.
