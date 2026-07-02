# Staging-Umgebung auf dem RTX-PC (On-Demand)

Stand: 2026-07-02

Runbook für ein **zweites, getrenntes Testsystem** neben der Produktion:

- **`main`** → Produktion auf dem UWE-Host (`studio` / `portal.uweanddragons.org`), Deploy wie gehabt über [`deploy.yml`](../../.github/workflows/deploy.yml).
- **`dev`** → Staging on-demand auf dem **RTX-PC** (`test.studio` / `test.portal.uweanddragons.org`), eigene Datenbank.

Der Prod-Host wird davon **nicht angefasst**. Staging läuft nur, wenn der RTX-PC an ist und du es manuell hochfährst.

> Warum der RTX-PC und nicht der Host: Der 4-GB-Host muss schon für **einen** Build die laufenden Apps stoppen (siehe [self-hosted-ci.md](self-hosted-ci.md) → Deploy-Runner). Ein zweites Dauer-System hätte dort keinen RAM. Der RTX-PC hat Reserven und ist ohnehin vorhanden (Ollama, RTX-Connector).

---

## Architektur-Prinzip: erreichbar bleiben, ohne inbound-Port

Der RTX-PC ist per Design **outbound-only** — „no public port, SSH or HTTP server is opened on the RTX side" ([rtx-connector.md](../rtx-connector.md)). Ein öffentliches `test.studio…` darf das nicht brechen.

Lösung: **`cloudflared` läuft auf dem RTX-PC selbst und wählt sich *ausgehend* zu Cloudflare ein** — genauso wie der Connector. Cloudflare routet die Test-Hostnames rückwärts durch diese ausgehende Verbindung auf `localhost:3002` / `:3003`.

```text
Browser ──▶ Cloudflare Edge ──▶ (ausgehender Tunnel) ──▶ RTX-PC localhost:3002/3003
```

**Kein einziger eingehender Port** auf dem RTX-PC. Die „outbound only"-Regel bleibt intakt — sogar strikter als beim Prod-Host, der auf `0.0.0.0` bindet.

---

## Trennung Prod ⇄ Staging

| Aspekt | Produktion (Host) | Staging (RTX-PC) |
|--------|-------------------|-------------------|
| Git-Branch | `main` | `dev` |
| Checkout | `/opt/uwe` | `C:\uwe-test` (eigener Clone) |
| Studio-Port | 3000 | 3002 |
| Portal-Port | 3001 | 3003 |
| Datenbank | `/var/lib/uwe/uwe.db` | `C:\uwe-test\data\uwe-test.db` |
| Uploads/Backups | `/var/lib/uwe/...` | `C:\uwe-test\data\...` |
| Secrets | `/etc/uwe/uwe.env` | eigene `.env` (**nie** die Prod-Werte) |
| Erreichbarkeit | Host-Tunnel → `studio`/`portal.…` | RTX-Tunnel → `test.studio`/`test.portal.…` |
| Zugriffsschutz | Cloudflare Access | Cloudflare Access (nur Owner-Mail) |
| Deploy | automatisch (`deploy.yml` nach CI auf `main`) | manuell/on-demand (`uwe-test-up.ps1`) |
| Cloud-AI | nach Konfiguration | aus (lokales Ollama) |

**Grundregel:** Alles Zustandsbehaftete und alle Secrets werden gedoppelt; nur der Git-Object-Store ist maschinenlokal. Ein Test-Leak darf niemals Prod-Zugriff bedeuten.

---

## Einmalige Einrichtung (RTX-PC, Windows)

Voraussetzungen: Windows, Node 22, `pnpm`, Git — auf dem RTX-PC bereits vorhanden (RTX-Connector-Setup).

### 1. Eigenen Checkout anlegen

```powershell
git clone https://github.com/Nehmo101/UWE.git C:\uwe-test
cd C:\uwe-test
git checkout dev
pnpm install --frozen-lockfile
```

Bewusst ein **separater** Clone, nicht der Connector-Checkout — Staging soll unabhängig hoch- und runterfahrbar sein.

### 2. Cloudflare-Tunnel (rein outbound)

```powershell
winget install Cloudflare.cloudflared
cloudflared tunnel login
cloudflared tunnel create uwe-test
cloudflared tunnel route dns uwe-test test.studio.uweanddragons.org
cloudflared tunnel route dns uwe-test test.portal.uweanddragons.org
```

Config unter `%USERPROFILE%\.cloudflared\config.yml`:

```yaml
tunnel: uwe-test
credentials-file: C:\Users\<du>\.cloudflared\<uuid>.json
ingress:
  - hostname: test.studio.uweanddragons.org
    service: http://localhost:3002
  - hostname: test.portal.uweanddragons.org
    service: http://localhost:3003
  - service: http_status:404
```

In Cloudflare für **beide** Test-Hostnames eine **Access-Policy** anlegen, die nur die Owner-Mail zulässt. Damit ist Staging nie öffentlich indexierbar.

### 3. Test-`.env` anlegen

`C:\uwe-test\.env` (Vorlage — Werte anpassen, Secrets neu erzeugen mit `openssl rand -base64 32`):

```bash
NODE_ENV=production
UWE_RUNTIME_ROLE=host

# Ports
STUDIO_PORT=3002
PORTAL_PORT=3003

# Öffentliche URLs — NEXT_PUBLIC_* werden beim BUILD eingebacken!
NEXT_PUBLIC_STUDIO_URL=https://test.studio.uweanddragons.org
NEXT_PUBLIC_PORTAL_URL=https://test.portal.uweanddragons.org
PUBLIC_BASE_URL=https://test.studio.uweanddragons.org
TRUST_PROXY=true
CLOUDFLARE_TUNNEL=true

# Secrets — EIGENE, niemals die Prod-Werte
SESSION_SECRET=<openssl rand -base64 32>
UWE_MEDIA_SIGNING_SECRET=<openssl rand -base64 32>

# Datenbank + Daten (Test) — absolute Pfade, Vorwärts-Slashes für Prisma
DATABASE_URL=file:C:/uwe-test/data/uwe-test.db
UWE_DATA_DIR=C:/uwe-test/data
UPLOADS_DIR=C:/uwe-test/data/uploads
BACKUPS_DIR=C:/uwe-test/data/backups
EXPORTS_DIR=C:/uwe-test/data/exports

# Seed-Verhalten
RUN_DB_SEED=auto

# Auth / Cookies (hinter HTTPS-Tunnel)
AUTH_REQUIRED=true
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_SAMESITE=lax

# AI: lokales Ollama auf dem RTX-PC nutzen, Cloud aus
AI_INFERENCE_ENABLED=true
AI_INFERENCE_PROVIDER=ollama
AI_INFERENCE_BASE_URL=http://localhost:11434
CLOUD_AI_PROVIDER=
```

> `SESSION_SECRET` und `UWE_MEDIA_SIGNING_SECRET` sind im Produktions-Build **Pflicht** — fehlen sie, bricht der Start ab. Deshalb hier immer eigene Werte setzen.

---

## On-Demand-Betrieb

Kein Windows-Service, kein Autostart — zwei Skripte. Wenn der RTX-PC aus ist, sind die Test-Hostnames einfach offline (für ein Testsystem in Ordnung).

### `uwe-test-up.ps1`

```powershell
#requires -Version 5
[CmdletBinding()]
param(
  [ValidateSet('build','dev')] [string]$Mode = 'build',
  [string]$Restore,
  [switch]$Fresh
)
$ErrorActionPreference = 'Stop'

# --- Konfiguration (einmalig anpassen) ---
$TestRoot = 'C:\uwe-test'
$EnvFile  = Join-Path $TestRoot '.env'
$TestDb   = 'C:\uwe-test\data\uwe-test.db'
$Branch   = 'dev'

Set-Location $TestRoot

# .env in die Prozess-Umgebung laden (gilt für alle Child-Prozesse: prisma, next, cloudflared)
Get-Content $EnvFile | Where-Object { $_ -match '^\s*[^#].*=' } | ForEach-Object {
  $name, $value = $_ -split '=', 2
  [Environment]::SetEnvironmentVariable($name.Trim(), $value.Trim(), 'Process')
}

# 1. Code auf dev aktualisieren
git fetch origin $Branch
git checkout $Branch
git reset --hard "origin/$Branch"

# 2. Dependencies
pnpm install --frozen-lockfile

# 3. Migrationen auf die Test-DB (der eigentliche Wert von Staging)
if ($Fresh) {
  Remove-Item $TestDb -ErrorAction SilentlyContinue   # frischer Start mit Demo-Daten
  pnpm db:deploy
  pnpm db:seed
} else {
  pnpm db:deploy
}

# 4. Optionaler Prod-Backup-Import (bewusster Debug-Modus, s.u.)
if ($Restore) {
  node --import tsx packages/backup/src/cli-restore.ts $Restore
}

# 5. Build (prod-nah) — nur im build-Modus
if ($Mode -eq 'build') {
  pnpm build:release
}

# 6. Prozesse starten: Studio 3002, Portal 3003, Tunnel
$sub = if ($Mode -eq 'build') { 'start' } else { 'dev' }
Start-Process pnpm -WorkingDirectory $TestRoot -ArgumentList @('--filter','@uwe/studio','exec','next',$sub,'--port','3002')
Start-Process pnpm -WorkingDirectory $TestRoot -ArgumentList @('--filter','@uwe/portal','exec','next',$sub,'--port','3003')
Start-Process cloudflared -ArgumentList @('tunnel','run','uwe-test')

Write-Host ""
Write-Host "Staging live:"
Write-Host "  Studio -> https://test.studio.uweanddragons.org  (lokal :3002)"
Write-Host "  Portal -> https://test.portal.uweanddragons.org  (lokal :3003)"
```

### `uwe-test-down.ps1`

```powershell
#requires -Version 5
[CmdletBinding()]
param([switch]$Wipe)

$TestDb = 'C:\uwe-test\data\uwe-test.db'

# Studio/Portal über ihre Listen-Ports beenden
foreach ($port in 3002, 3003) {
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
}

# Tunnel beenden
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force

if ($Wipe) {
  Remove-Item $TestDb -ErrorAction SilentlyContinue
  Write-Host "Test-DB geloescht — naechster 'up -Fresh' startet mit Demo-Seed."
}
```

### Aufrufe

```powershell
.\uwe-test-up.ps1                       # dev pullen, bauen, starten (Demo-Daten wenn DB neu)
.\uwe-test-up.ps1 -Fresh                # Test-DB verwerfen und frisch seeden
.\uwe-test-up.ps1 -Restore C:\backups\uwe-full.zip   # mit Prod-Backup (Debug-Modus)
.\uwe-test-up.ps1 -Mode dev             # schneller next dev statt Build (Prod-abweichend)
.\uwe-test-down.ps1                     # stoppen
.\uwe-test-down.ps1 -Wipe               # stoppen und Test-DB löschen
```

---

## Prod-Backup in Staging einspielen (Debug-Modus)

Manchmal muss ein Prod-spezifischer Bug mit echten Daten reproduziert werden.

1. Auf dem Host ein Full-Backup erzeugen (Studio → **Backup**, oder `pnpm backup:create --type=full`) → liegt unter `/var/lib/uwe/backups/`.
2. Das ZIP auf den RTX-PC holen — **vom RTX aus ziehen** (Download über den Tunnel im Browser, oder `scp`/`rsync` vom RTX zum Host). Bleibt outbound-only; der Host verbindet sich nie zum RTX.
3. `.\uwe-test-up.ps1 -Restore C:\backups\uwe-full.zip`
   Der Restore-CLI ([`cli-restore.ts`](../../packages/backup/src/cli-restore.ts)) schreibt in die per `DATABASE_URL`/`UPLOADS_DIR` gesetzten **Test**-Pfade.

**Datenschutz-Hinweis:** Ein Full-Backup enthält echte Welt- **und** Life-Brain-Daten (siehe [backup-restore.md](../backup-restore.md)). In diesem Modus liegen also reale Inhalte auf dem RTX-PC. Zwei Dinge entschärfen das:

- **Secrets, Passwörter und Sessions sind nie im Backup** — es ist weniger heikel als eine rohe DB-Kopie.
- Nach dem Debuggen `.\uwe-test-down.ps1 -Wipe` ausführen: Test-DB löschen, beim nächsten `up -Fresh` steht wieder die Demo-Welt. So bleibt der Backup-Import ein **bewusster, temporärer** Zustand, nicht der Normalfall.

Default bleibt: Staging läuft auf Demo-Seed, **ohne** echte Daten auf dem RTX-PC.

---

## Promotion-Flow

```text
Feature-Branch
   └─▶ dev            → RTX hochziehen (uwe-test-up.ps1), inkl. Migration testen
        └─▶ (grün)    → dev nach main mergen
             └─▶ main → Prod-Deploy läuft automatisch (deploy.yml)
```

Der eigentliche Nutzen ist nicht „UI angucken", sondern **Prisma-Migrationen gegen realistische Daten laufen zu lassen, bevor sie Prod-Daten anfassen**. Genau da tut ein kaputtes Schema am meisten weh.

---

## Sicherheit & Datenschutz

- **Eigene Secrets** in der Test-`.env` — niemals die Prod-Werte kopieren.
- **Cloudflare Access** vor beiden Test-Hostnames (nur Owner-Mail).
- **Kein inbound-Port** auf dem RTX-PC — Tunnel und AI sind ausgehend/lokal.
- **Cloud-AI aus** in Staging (`CLOUD_AI_PROVIDER=` leer); lokales Ollama genügt.
- **Default ohne echte Daten**; Prod-Backup nur als bewusster, aufräumbarer Debug-Modus.

---

## Verwandte Dateien

| Datei | Zweck |
|-------|--------|
| [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml) | Prod-Deploy auf `main` (unberührt) |
| [self-hosted-ci.md](self-hosted-ci.md) | Deploy-Runner, RAM-Grenzen des Hosts |
| [rtx-connector.md](../rtx-connector.md) | Outbound-Prinzip des RTX-PCs |
| [backup-restore.md](../backup-restore.md) | Backup-Inhalte, Restore-Wege |
| [`packages/backup/src/cli-restore.ts`](../../packages/backup/src/cli-restore.ts) | CLI-Restore in die Test-DB |

---

## Entscheidungslog

| Datum | Entscheidung |
|-------|--------------|
| 2026-07-02 | 2-Branch-Modell (`main`=Prod, `dev`=Staging). Staging **on-demand auf dem RTX-PC** statt auf dem 4-GB-Host — voll getrennt, eigene SQLite-DB, eigener outbound Cloudflare-Tunnel. Prod-Deploy-Pfad unverändert. |
