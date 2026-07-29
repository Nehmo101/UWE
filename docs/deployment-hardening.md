# UWE Deployment-Hardening — Alter Linux-Laptop mit Cloudflare Tunnel

Anleitung für den **sicheren Selfhosting-Betrieb** von UWE auf einem alten Linux-Laptop **ohne Router-Portfreigabe**. Der einzige Weg von außen nach innen ist der **Cloudflare Tunnel** (`cloudflared`).

| Prinzip | Umsetzung |
|---------|-----------|
| Keine WAN-Ports | UFW blockiert eingehend; UWE lauscht nur auf `127.0.0.1` |
| Nur Cloudflare Tunnel | Öffentlicher HTTPS-Traffic über `cloudflared`, nicht über den Router |
| Least privilege | Dedizierter Linux-User `uwe`, keine Root-Prozesse |
| Getrennte Daten | App-Daten unter `/var/lib/uwe`, Backups unter `/var/backups/uwe` |
| Minimale Health-Probes | `/api/health/public` gibt nur `ok` zurück |
| Details nur für Owner | `/api/health/private` mit Token bzw. Owner-Session |

Weitere Hintergründe: [PRODUCTION.md](./PRODUCTION.md).

---

## Architektur

```txt
Internet
  ↓ HTTPS (Cloudflare Edge)
Cloudflare Tunnel (cloudflared auf dem Laptop)
  ↓ http://127.0.0.1:3000  Studio
  ↓ http://127.0.0.1:3001  Portal
Alter Linux-Laptop (UWE Host)
  ↓ nur Heimnetz (kein Port-Forward)
RTX-Rechner (Ollama / UWE RTX-Agent — niemals öffentlich)
```

**Wichtig:** Der RTX-Rechner und Ollama dürfen **nicht** im Tunnel oder Router freigegeben werden. Nur UWE Studio/Portal laufen hinter Cloudflare.

---

## 1. Voraussetzungen

- Ubuntu 22.04/24.04 LTS oder Debian 12 (andere systemd-Distributionen analog)
- Node.js ≥ 20, pnpm ≥ 10 (nur zum Build; Runtime nutzt standalone)
- Cloudflare-Account mit Domain
- SSH-Zugang **nur aus dem LAN** (oder gar kein SSH von außen)

---

## 2. System-User und Verzeichnisse

Als `root` oder mit `sudo`:

```bash
# Dedizierter Service-User (kein Login-Shell)
sudo useradd --system --home /opt/uwe --shell /usr/sbin/nologin uwe

# App-Daten (DB, Uploads, Exports)
sudo mkdir -p /var/lib/uwe/{uploads,exports}
sudo chown -R uwe:uwe /var/lib/uwe
sudo chmod 750 /var/lib/uwe

# Backups getrennt (eigenes Volume / externe Platte möglich)
sudo mkdir -p /var/backups/uwe
sudo chown uwe:uwe /var/backups/uwe
sudo chmod 750 /var/backups/uwe

# Log-Verzeichnis (journald reicht meist; optional Datei-Logs)
sudo mkdir -p /var/log/uwe
sudo chown uwe:uwe /var/log/uwe

# Konfiguration (Secrets — nicht ins Git)
sudo mkdir -p /etc/uwe
sudo chmod 700 /etc/uwe
```

---

## 3. UWE installieren und bauen

```bash
sudo mkdir -p /opt/uwe
sudo chown uwe:uwe /opt/uwe

sudo -u uwe git clone <repository-url> /opt/uwe
cd /opt/uwe

# Production-ENV anlegen (Werte ersetzen!)
sudo cp .env.production.example /etc/uwe/uwe.env
sudo chmod 600 /etc/uwe/uwe.env
sudo chown root:uwe /etc/uwe/uwe.env
sudo nano /etc/uwe/uwe.env

# Secrets erzeugen
openssl rand -base64 32   # → AUTH_SECRET
openssl rand -base64 32   # → STUDIO_API_TOKEN

# Build (einmalig bzw. nach Updates)
sudo -u uwe bash -lc 'cd /opt/uwe && corepack enable && pnpm install --frozen-lockfile'
sudo -u uwe bash -lc 'cd /opt/uwe && set -a && source /etc/uwe/uwe.env && set +a && pnpm build:release'
sudo -u uwe bash -lc 'cd /opt/uwe && set -a && source /etc/uwe/uwe.env && set +a && pnpm db:migrate'

# Start-Skript ausführbar
sudo chmod +x /opt/uwe/deploy/scripts/start-uwe.sh
sudo chmod +x /opt/uwe/deploy/scripts/uwe-backup.sh
```

**Hinweis:** `.env.production.example` im Repository ist die Vorlage. Die live-Datei liegt unter `/etc/uwe/uwe.env` (mode `600`, Gruppe `uwe`).

---

## 4. systemd — UWE als Service

```bash
sudo cp /opt/uwe/deploy/systemd/uwe.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now uwe.service
sudo systemctl status uwe.service
```

Die Unit [`deploy/systemd/uwe.service`](../deploy/systemd/uwe.service) startet Studio und Portal über [`deploy/scripts/start-uwe.sh`](../deploy/scripts/start-uwe.sh):

- Prozesse laufen als User **`uwe`** (nicht root)
- Bindung an **`127.0.0.1`** (kein direkter LAN/WAN-Zugriff auf die Node-Ports)
- ENV aus `/etc/uwe/uwe.env`
- Neustart bei Absturz (`Restart=on-failure`)

Logs ansehen (keine Secrets in strukturierten Health-Responses; siehe Abschnitt Logging):

```bash
journalctl -u uwe.service -f
```

---

## 5. Cloudflare Tunnel (keine Router-Portfreigabe)

**Am Router:** Keine Port-Weiterleitung für 80, 443, 3000 oder 3001 einrichten.

### 5.1 cloudflared installieren

```bash
# Debian/Ubuntu (Beispiel — aktuelle Anleitung: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared jammy main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install -y cloudflared
```

### 5.2 Tunnel anlegen

Auf dem Laptop (interaktiv, einmalig):

```bash
cloudflared tunnel login
cloudflared tunnel create uwe-laptop
cloudflared tunnel route dns uwe-laptop uwe.example.org
```

#### Variante A — Unified Path (ein Hostname, empfohlen)

Portal unter `/`, Studio unter `/studio`, Studio-API unter `/studio/api/*`. Ein lokaler Reverse Proxy (Caddy/nginx) terminiert beide Apps; der Tunnel zeigt nur auf den Proxy.

Siehe [docs/cloudflare-access.md](./cloudflare-access.md) für Caddy/nginx-Beispiele und Cloudflare-Access-Pfade (`/studio*`, `/admin*`, `/setup*` — **kein** Access auf `/api/*`).

`/etc/uwe/uwe.env` (Auszug):

```env
PUBLIC_APP_URL=https://uwe.example.org
STUDIO_PATH=/studio
NEXT_PUBLIC_STUDIO_PATH=/studio
TRUST_PROXY=true
CLOUDFLARE_TUNNEL=true
CLOUDFLARE_ACCESS_ENABLED=true
```

`/etc/cloudflared/config.yml`:

```yaml
tunnel: uwe-laptop
credentials-file: /etc/cloudflared/uwe-laptop.json

ingress:
  - hostname: uwe.example.org
    service: http://127.0.0.1:8080   # lokaler Reverse Proxy
  - service: http_status:404
```

#### Variante B — Getrennte Hostnames

```bash
cloudflared tunnel route dns uwe-laptop portal.uwe.example.org
```

Konfiguration `/etc/cloudflared/config.yml`:

```yaml
tunnel: uwe-laptop
credentials-file: /etc/cloudflared/uwe-laptop.json

ingress:
  - hostname: uwe.example.org
    service: http://127.0.0.1:3000
  - hostname: portal.uwe.example.org
    service: http://127.0.0.1:3001
  - service: http_status:404
```

### 5.3 cloudflared als systemd-Service

Cloudflare liefert eine fertige Unit — nach der offiziellen Doku installieren:

```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared
```

Referenz: [Cloudflare Tunnel — run as a service](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/configure-tunnels/local-management/as-a-service/linux/)

**Empfohlen:** Cloudflare Access vor Studio legen (zusätzliche Schicht neben UWE-Session-Login). Studio hat `/login` für `owner`/`admin`/`dm` — allein reicht das nicht für öffentliche Exposition.

### 5.4 Smoke-Check über den Tunnel

```bash
# Öffentlich — nur "ok", keine Interna
curl -sf https://uwe.example.org/api/health/public
curl -sf https://portal.uwe.example.org/api/health/public

# Privat — Studio (Token)
curl -sf -H "Authorization: Bearer $STUDIO_API_TOKEN" \
  https://uwe.example.org/api/health/private | jq .status

# Privat — Portal (als Owner eingeloggt, Session-Cookie)
curl -sf -b "uwe_session=..." https://portal.uwe.example.org/api/health/private | jq .status
```

---

## 6. UFW-Firewall

Standard: alles eingehend blockieren, ausgehend erlauben. SSH nur aus dem LAN (Beispiel Subnetz `192.168.178.0/24` — anpassen):

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing

# SSH nur aus dem Heimnetz (oder weglassen, wenn kein Remote-SSH nötig)
sudo ufw allow from 192.168.178.0/24 to any port 22 proto tcp comment 'SSH LAN only'

# Keine Regeln für 3000/3001 — UWE ist nur localhost + Tunnel erreichbar

sudo ufw enable
sudo ufw status verbose
```

**Gar kein SSH von außen:** Einfach keine `ufw allow` für Port 22 setzen und physisch am Laptop administrieren.

---

## 7. Automatische Security-Updates

### Debian/Ubuntu (unattended-upgrades)

```bash
sudo apt install -y unattended-upgrades apt-listchanges
sudo dpkg-reconfigure -plow unattended-upgrades
```

Prüfen:

```bash
cat /etc/apt/apt.conf.d/50unattended-upgrades | head
systemctl status unattended-upgrades
```

Empfehlung: Nach Kernel-Updates geplant neu starten (Wartungsfenster) — UWE startet via systemd automatisch wieder.

---

## 8. Healthchecks

| Endpoint | Auth | Antwort |
|----------|------|---------|
| `GET /api/health/public` | Keine | Plain text: `ok` oder `degraded` (HTTP 200/503) |
| `GET /api/health/private` | Studio: `Authorization: Bearer <STUDIO_API_TOKEN>` · Portal: Session als globaler **`owner`** | JSON mit DB, Migrationen, Storage, Proxy — **ohne Secrets** |
| `GET /api/health` | Keine (Legacy) | Vollständiges JSON — für lokale/Docker-Checks; **nicht** für öffentliche Monitoring-URLs nutzen |

**Rollen-Mapping:** UWE kennt die globale Rolle `owner` (= System-Administrator). „ADMIN/OWNER“ in dieser Doku meint **`owner`**.

### systemd / Cron Monitoring (lokal)

```bash
# Tunnel-Uptime (öffentlich)
curl -sf http://127.0.0.1:3000/api/health/public
curl -sf http://127.0.0.1:3001/api/health/public

# Betriebsdetails (Studio, Token aus /etc/uwe/uwe.env)
source /etc/uwe/uwe.env
curl -sf -H "Authorization: Bearer $STUDIO_API_TOKEN" \
  http://127.0.0.1:3000/api/health/private | jq '{status, checks: .checks.storage}'
```

Cloudflare Health Checks und externe Uptime-Dienste sollten **`/api/health/public`** verwenden.

---

## 9. Logging

### Grundsätze

- **Keine Secrets** in Logs oder Health-JSON: keine Werte von `AUTH_SECRET`, `STUDIO_API_TOKEN`, SMTP-Passwörter, API-Keys, RTX-Tokens.
- UWE loggt Fehler über **stderr** → **journald** (`journalctl -u uwe.service`).
- Activity-/Mail-Logs in der Datenbank enthalten keine Passwörter (siehe `SECURITY.md`).

### journald — Rotation / Größe

`/etc/systemd/journald.conf.d/uwe.conf`:

```ini
[Journal]
SystemMaxUse=500M
MaxRetentionSec=4week
```

```bash
sudo systemctl restart systemd-journald
```

### Optional: Log-Datei mit logrotate

`/etc/logrotate.d/uwe`:

```
/var/log/uwe/*.log {
    weekly
    rotate 8
    compress
    delaycompress
    missingok
    notifempty
    create 640 uwe uwe
    sharedscripts
    postrotate
        systemctl reload uwe.service >/dev/null 2>&1 || true
    endscript
}
```

---

## 10. Backups (systemd timer)

Tägliches Backup in das **getrennte** Verzeichnis `/var/backups/uwe`:

```bash
sudo cp /opt/uwe/deploy/systemd/uwe-backup.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now uwe-backup.timer
systemctl list-timers | grep uwe-backup
```

Manuell:

```bash
sudo -u uwe bash -lc 'set -a && source /etc/uwe/uwe.env && set +a && cd /opt/uwe && pnpm backup:create'
ls -la /var/backups/uwe
```

Backups regelmäßig **off-site** kopieren (USB, NAS, rsync). Siehe [backup-restore.md](./backup-restore.md).

---

## 10a. Morning Briefing (systemd timer, optional)

Erzeugt täglich lokal per RTX ein Morning Briefing. **An/Aus und Uhrzeit werden in
UWE gesetzt** (Einstellungen → Briefing) und zur host-lesbaren
`data/briefings/schedule.json` gesynct. Der Timer tickt alle 15 min; das Skript
triggert einmal täglich zur konfigurierten Zeit einen internen Endpoint (Guard:
`STUDIO_API_TOKEN`), der den Briefing-Job im **laufenden** Server dispatcht.

Installation (einmalig) — am einfachsten über das Sammel-Skript, das **alle**
UWE-Units installiert und die Timer aktiviert:

```bash
sudo /opt/uwe/deploy/scripts/install-systemd-units.sh
```

Oder nur das Briefing:

```bash
sudo cp /opt/uwe/deploy/systemd/uwe-briefing.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now uwe-briefing.timer
```

Voraussetzung: `STUDIO_API_TOKEN` in `/etc/uwe/uwe.env`. Optional
`UWE_BRIEFING_USER_ID` (sonst erster aktiver Owner/Admin) und
`UWE_INTERNAL_BASE_URL` (Default `http://127.0.0.1:3000`). Manuell testen:

```bash
curl -fsS -X POST -H "Authorization: Bearer $STUDIO_API_TOKEN" \
  http://127.0.0.1:3000/api/internal/briefing
```

---

## 11. Optional: fail2ban für SSH

Nur sinnvoll, wenn SSH aus dem LAN erlaubt ist und Brute-Force-Schutz gewünscht wird:

```bash
sudo apt install -y fail2ban
```

`/etc/fail2ban/jail.d/sshd-local.conf`:

```ini
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 5
findtime = 10m
bantime = 1h
ignoreip = 127.0.0.1/8 192.168.178.0/24
```

```bash
sudo systemctl enable --now fail2ban
sudo fail2ban-client status sshd
```

---

## 12. Production-Checkliste

- [ ] Keine Router-Portfreigabe (80/443/3000/3001)
- [ ] UFW aktiv (`default deny incoming`)
- [ ] UWE lauscht auf `127.0.0.1` (systemd + `HOSTNAME=127.0.0.1`)
- [ ] `cloudflared` läuft und zeigt nur auf Studio/Portal
- [ ] `/etc/uwe/uwe.env` mode `600`, starke `AUTH_SECRET` und `STUDIO_API_TOKEN`
- [ ] `RUN_DB_SEED=false`
- [ ] `AUTH_REQUIRED=true`, `SESSION_COOKIE_SECURE=true` hinter HTTPS
- [ ] `AI_INFERENCE_ALLOW_PUBLIC_URL=false`, RTX nur im LAN
- [ ] User `uwe` (nicht root) betreibt Node
- [ ] `/var/lib/uwe` (Daten) und `/var/backups/uwe` (Backups) getrennt
- [ ] `unattended-upgrades` aktiv
- [ ] Öffentliches Monitoring nutzt `/api/health/public`
- [ ] Details nur über `/api/health/private` + Token/Owner

---

## 13. Update-Ablauf

```bash
sudo systemctl stop uwe.service
sudo -u uwe bash -lc 'cd /opt/uwe && pnpm backup:create'
sudo -u uwe bash -lc 'cd /opt/uwe && git pull && pnpm install --frozen-lockfile && pnpm build:release'
sudo -u uwe bash -lc 'cd /opt/uwe && set -a && source /etc/uwe/uwe.env && set +a && pnpm db:migrate'
sudo systemctl start uwe.service
curl -sf http://127.0.0.1:3000/api/health/public
```

---

## Referenz-Dateien im Repository

| Datei | Zweck |
|-------|-------|
| [`.env.production.example`](../.env.production.example) | Production-ENV-Vorlage |
| [`deploy/systemd/uwe.service`](../deploy/systemd/uwe.service) | systemd Unit für UWE |
| [`deploy/systemd/uwe-backup.timer`](../deploy/systemd/uwe-backup.timer) | Tägliches Backup |
| [`deploy/systemd/uwe-briefing.timer`](../deploy/systemd/uwe-briefing.timer) | Morning Briefing (Zeit in UWE konfigurierbar) |
| [`deploy/scripts/install-systemd-units.sh`](../deploy/scripts/install-systemd-units.sh) | Einmal-Bootstrap: alle Units installieren + Timer aktivieren |
| [`deploy/scripts/start-uwe.sh`](../deploy/scripts/start-uwe.sh) | Start Studio + Portal |
| [`SECURITY.md`](../SECURITY.md) | Security Policy |

**cloudflared:** Offizielle systemd-Unit von Cloudflare installieren (Abschnitt 5.3) — nicht ins UWE-Repo duplizieren, da Version/Pfad distributionsabhängig ist.
