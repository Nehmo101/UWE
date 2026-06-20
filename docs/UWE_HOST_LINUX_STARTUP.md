# UWE auf Linux — Host-Laptop starten (Heimnetz)

Praktische Anleitung für den **UWE-Host-Laptop** unter Linux (Ubuntu, Lubuntu, Linux Mint, …).

UWE besteht aus zwei Web-Apps:

| App | Standard-Port | Zweck |
|-----|---------------|-------|
| **Studio** | 3000 | Spielleiter-Editor (DM) |
| **Portal** | 3001 | Spieler-Wiki |

Nach dem Start sind beide im **Heimnetz** erreichbar (nicht nur auf dem Laptop selbst).

---

## Kurzüberblick

| Situation | Befehl |
|-----------|--------|
| Einmal starten (ohne Autostart) | `pnpm host:start` |
| Status prüfen | `pnpm host:status` |
| Stoppen | `pnpm host:stop` |
| Autostart einrichten (einmalig) | `pnpm host:install-autostart` |
| Autostart entfernen | `pnpm host:uninstall-autostart` |

Alle Befehle im **UWE-Projektordner** ausführen (dort wo `package.json` liegt).

---

## Erstes Mal einrichten (einmalig)

1. **Node.js 20+** und **pnpm** installieren:

   ```bash
   # Node.js (Beispiel Ubuntu/Debian)
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs

   # pnpm
   corepack enable
   corepack prepare pnpm@10.12.1 --activate
   ```

2. Repository klonen oder entpacken, z. B. nach `~/UWE`:

   ```bash
   cd ~/UWE
   ```

3. **Umgebungsdatei** anlegen:

   ```bash
   cp .env.example .env
   nano .env   # mindestens SESSION_SECRET anpassen
   ```

   Geheimnis erzeugen: `openssl rand -base64 32`

4. **Erstes Owner-Setup** (Produktion ohne Demo-Seed):

   ```bash
   # In .env setzen:
   # UWE_SETUP_TOKEN=$(openssl rand -hex 32)
   # RUN_DB_SEED=false
   # STUDIO_API_TOKEN=$(openssl rand -base64 32)   # empfohlen — blockiert /setup nicht
   ```

   Browser: **`http://127.0.0.1:3000/setup`** — Setup-Token eingeben, Owner anlegen.  
   Danach ist `/setup` nicht mehr verfügbar (Weiterleitung zur Anmeldung). Details: [PRODUCTION.md](./PRODUCTION.md).

5. **Teststart**:

   ```bash
   pnpm host:start
   pnpm host:status
   ```

6. Optional **Autostart nach Neustart** (siehe Abschnitt C).

---

## A) Laptop neu gestartet — Autostart ist aktiv

1. Am Host-Laptop **einloggen** (einmalig nach Neustart reicht oft schon).
2. **Terminal** öffnen.
3. **Status prüfen**:

   ```bash
   cd ~/UWE          # Ihren UWE-Ordner einsetzen
   pnpm host:status
   ```

   Oder mit systemd:

   ```bash
   sudo systemctl status uwe-host
   ```

4. Auf **Haupt-PC oder Handy** (gleiches WLAN) im Browser öffnen:

   ```
   http://<IP-DES-HOST-LAPTOPS>:3000
   ```

   Die IP steht in der Ausgabe von `pnpm host:status` unter **LAN-IP**.

### IP des Host-Laptops finden

Am Host-Laptop im Terminal:

```bash
hostname -I
```

Erste angezeigte Adresse verwenden (z. B. `192.168.1.42`).

Alternativ:

```bash
ip -4 addr show | grep inet
```

### Vom Haupt-PC / Handy öffnen

Beide Geräte müssen im **gleichen Heimnetz/WLAN** sein.

| Was | URL |
|-----|-----|
| Studio (DM) | `http://192.168.x.x:3000` |
| Portal (Spieler) | `http://192.168.x.x:3001` |

`192.168.x.x` durch die LAN-IP aus `hostname -I` ersetzen.

---

## B) Autostart ist **nicht** aktiv — manueller Start

1. Terminal öffnen.
2. In den UWE-Ordner wechseln:

   ```bash
   cd ~/UWE
   ```

3. Starten:

   ```bash
   pnpm host:start
   ```

4. Status prüfen:

   ```bash
   pnpm host:status
   ```

5. URLs aus der Ausgabe im Browser öffnen (lokal oder im Heimnetz).

**Hinweis:** Nach Schließen des Terminals läuft UWE weiter (Hintergrund). Zum Stoppen: `pnpm host:stop`.

---

## C) Autostart einmalig einrichten

UWE startet dann **automatisch nach jedem Neustart** (systemd-Systemdienst).

1. In den UWE-Ordner wechseln:

   ```bash
   cd ~/UWE
   ```

2. Autostart installieren (fragt nach sudo-Passwort):

   ```bash
   pnpm host:install-autostart
   ```

   Das Skript richtet Abhängigkeiten, Datenbank und Build ein, kopiert die Service-Datei nach `/etc/systemd/system/uwe-host.service` und aktiviert den Dienst.

3. **Neustart testen**:

   ```bash
   sudo reboot
   ```

4. Nach dem Neustart prüfen:

   ```bash
   pnpm host:status
   ```

### Manueller Start vs. Autostart

| | Manuell (`pnpm host:start`) | Autostart (systemd) |
|--|----------------------------|---------------------|
| Wann starten | Jedes Mal per Befehl | Automatisch nach Boot |
| Logs | `.uwe-host/logs/host.log` | `journalctl -u uwe-host` |
| Stoppen | `pnpm host:stop` | `sudo systemctl stop uwe-host` |
| Neustart | `pnpm host:start -- --restart` | `sudo systemctl restart uwe-host` |

**Warum systemd-Systemdienst?** Startet ohne weiteren Klick nach Reboot, überlebt Abstürze (`Restart=on-failure`), Logs zentral in journald. Die Vorlage liegt unter `deploy/linux/uwe-host.service` — Pfade werden beim Installieren automatisch gesetzt (kein hart codierter `/home/uwe/UWE`).

---

## D) Fehlerbehebung

### Keine IP sichtbar / `<LAN-IP>` in der Ausgabe

```bash
hostname -I
ip -4 route get 1.1.1.1
```

WLAN/Ethernet prüfen. Router muss Geräte im gleichen Subnetz sehen.

### Port 3000 oder 3001 belegt

```bash
ss -ltnp | grep -E ':3000|:3001'
pnpm host:stop
```

Falls weiter belegt: fremden Prozess identifizieren und beenden (nicht wahllos alle Node-Prozesse killen).

### `pnpm` nicht gefunden

```bash
corepack enable
corepack prepare pnpm@10.12.1 --activate
```

Terminal neu öffnen.

### `node` nicht gefunden

Node.js 20+ installieren (siehe Erstes Mal einrichten).

### `.env` fehlt

```bash
cp .env.example .env
nano .env
```

`.env` wird **nie** vom Skript überschrieben.

### Datenbank nicht erreichbar / Migrationsfehler

```bash
pnpm --filter @uwe/database db:generate
pnpm --filter @uwe/database db:deploy
```

Datenbankpfad steht in `.env` (`DATABASE_URL`). Standard: `file:./data/uwe.db` relativ zu `packages/database`.

### UWE startet, aber Haupt-PC/Handy erreicht es nicht

1. Gleiches WLAN?
2. Firewall am Host-Laptop:

   ```bash
   sudo ufw status
   sudo ufw allow 3000/tcp
   sudo ufw allow 3001/tcp
   ```

3. Lauscht UWE auf allen Interfaces?

   ```bash
   ss -ltnp | grep -E ':3000|:3001'
   ```

   Erwartung: `0.0.0.0:3000` und `0.0.0.0:3001` (Heimnetz-Modus).

4. IP mit `hostname -I` am **Host-Laptop** prüfen, nicht am Haupt-PC.

### Logs anzeigen

**Manueller Start:**

```bash
tail -f .uwe-host/logs/host.log
```

**Autostart (systemd):**

```bash
sudo journalctl -u uwe-host -f
```

### Service neustarten

```bash
sudo systemctl restart uwe-host
pnpm host:status
```

### UWE sauber stoppen

```bash
pnpm host:stop
# oder bei Autostart:
sudo systemctl stop uwe-host
```

---

## Sicherheit (wichtig)

- UWE lauscht im Host-Modus auf **0.0.0.0** — erreichbar für alle Geräte im **Heimnetz**.
- **Nicht** ohne Schutz direkt ins Internet stellen (kein Port-Forwarding auf die WAN-Seite).
- Für öffentliche Erreichbarkeit später: **Cloudflare Tunnel**, Reverse Proxy mit Auth, VPN oder echtes Login — siehe `docs/deployment-hardening.md` und `docs/cloudflare-access.md`.
- Keine `.env`-Dateien teilen oder ins Git committen.
- `SESSION_SECRET` in Production stark setzen (`RUN_DB_SEED=false` nach erstem Setup empfohlen).

---

## Technische Details (optional)

| Datei | Zweck |
|-------|-------|
| `scripts/uwe-host-start.sh` | Start mit Prüfungen, Build, Hintergrund |
| `scripts/uwe-host-stop.sh` | Stoppt nur UWE-Prozesse (PID-Dateien) |
| `scripts/uwe-host-status.sh` | Status, Ports, LAN-URLs, Logs |
| `scripts/uwe-host-run.sh` | Foreground-Runner (systemd) |
| `deploy/linux/uwe-host.service` | systemd-Vorlage |

Skripte ausführbar machen (falls nötig):

```bash
chmod +x scripts/uwe-host-*.sh scripts/install-uwe-autostart.sh scripts/uninstall-uwe-autostart.sh
```

Weitere Production-Optionen: `docs/PRODUCTION.md`, Docker: `docker compose up -d`.
