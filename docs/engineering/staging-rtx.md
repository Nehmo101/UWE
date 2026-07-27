# Staging-Umgebung auf dem RTX-PC (On-Demand)

Stand: 2026-07-02

Runbook für ein **zweites, getrenntes Testsystem** neben der Produktion:

- **`main`** → Produktion auf dem UWE-Host (`studio` / `portal.uweanddragons.org`), Deploy wie gehabt über [`deploy.yml`](../../.github/workflows/deploy.yml).
- **`dev`** → Staging on-demand auf dem **RTX-PC** (`test.studio` / `test.portal.uweanddragons.org`), eigene Datenbank.

Der Prod-Host wird davon **nicht angefasst**. Staging läuft nur, wenn der RTX-PC an ist und du es manuell hochfährst.

> Warum der RTX-PC und nicht der Host: Der 4-GB-Host muss schon für **einen** Build die laufenden Apps stoppen (siehe [self-hosted-ci.md](self-hosted-ci.md) → Deploy-Runner). Ein zweites Dauer-System hätte dort keinen RAM. Der RTX-PC hat Reserven und ist ohnehin vorhanden (Ollama, RTX-Connector).

Die einsatzfertigen Vorlagen (Skripte, `.env`, Tunnel-Config) liegen unter [`deploy/rtx-staging/`](../../deploy/rtx-staging/); dieses Dokument erklärt Aufbau und Betrieb.

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

> **Einmalig zuerst:** Der `dev`-Branch muss auf `origin` existieren. Falls nicht, einmal von einem beliebigen Checkout aus anlegen: `git checkout -b dev main && git push -u origin dev`.

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

Config unter `%USERPROFILE%\.cloudflared\config.yml` — Vorlage: [`deploy/rtx-staging/cloudflared-config.yml.example`](../../deploy/rtx-staging/cloudflared-config.yml.example):

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

Kopiere [`deploy/rtx-staging/uwe-test.env.example`](../../deploy/rtx-staging/uwe-test.env.example) nach `C:\uwe-test\.env` und passe die Werte an (Secrets neu erzeugen mit `openssl rand -base64 32`). Die wichtigen Punkte:

- Ports `3002`/`3003`, URLs auf `test.studio` / `test.portal.uweanddragons.org`.
- **Eigenes** `SESSION_SECRET` — im Produktions-Build **Pflicht**, sonst bricht der Start ab.
- `DATABASE_URL=file:C:/uwe-test/data/uwe-test.db` — getrennte Datei, Vorwärts-Slashes für Prisma.
- `NEXT_PUBLIC_*` werden beim **Build** eingebacken; `uwe-test-up.ps1` lädt die `.env` daher vor `build:release` in die Prozess-Umgebung.
- `AI_INFERENCE_BASE_URL=http://localhost:11434` (lokales Ollama), `CLOUD_AI_PROVIDER=` leer.

---

## On-Demand-Betrieb

Kein Windows-Service, kein Autostart — zwei Skripte unter [`deploy/rtx-staging/`](../../deploy/rtx-staging/). Wenn der RTX-PC aus ist, sind die Test-Hostnames einfach offline (für ein Testsystem in Ordnung).

- [`uwe-test-up.ps1`](../../deploy/rtx-staging/uwe-test-up.ps1) — lädt die `.env`, pullt `dev`, migriert die Test-DB, baut prod-nah (`build:release`) und startet Studio (:3002), Portal (:3003) und den Tunnel.
- [`uwe-test-down.ps1`](../../deploy/rtx-staging/uwe-test-down.ps1) — stoppt alles (per Listen-Port + `cloudflared`); `-Wipe` löscht zusätzlich die Test-DB.

Den **Konfig-Block** am Kopf von `uwe-test-up.ps1` (Pfade, Branch, Tunnel-Name) einmalig anpassen.

### Aufrufe

```powershell
.\uwe-test-up.ps1                       # dev pullen, bauen, starten (Demo-Daten wenn DB neu)
.\uwe-test-up.ps1 -Fresh                # Test-DB verwerfen und frisch seeden
.\uwe-test-up.ps1 -Restore C:\backups\uwe-full.zip   # mit Prod-Backup (Debug-Modus)
.\uwe-test-up.ps1 -Mode dev             # schneller next dev statt Build (Prod-abweichend)
.\uwe-test-down.ps1                     # stoppen
.\uwe-test-down.ps1 -Wipe               # stoppen und Test-DB löschen
```

> Bei blockierter Ausführungsrichtlinie: `powershell -ExecutionPolicy Bypass -File .\uwe-test-up.ps1`.

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
| [`deploy/rtx-staging/`](../../deploy/rtx-staging/) | Up/Down-Skripte, `.env`- und Tunnel-Vorlage (Windows) |
| [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml) | Prod-Deploy auf `main` (unberührt) |
| [self-hosted-ci.md](self-hosted-ci.md) | Deploy-Runner, RAM-Grenzen des Hosts |
| [rtx-connector.md](../rtx-connector.md) | Outbound-Prinzip des RTX-PCs |
| [backup-restore.md](../backup-restore.md) | Backup-Inhalte, Restore-Wege |
| [`packages/backup/src/cli-restore.ts`](../../packages/backup/src/cli-restore.ts) | CLI-Restore in die Test-DB |

---

## Entscheidungslog

| Datum | Entscheidung |
|-------|--------------|
| 2026-07-02 | 2-Branch-Modell (`main`=Prod, `dev`=Staging). Staging **on-demand auf dem RTX-PC** statt auf dem 4-GB-Host — voll getrennt, eigene SQLite-DB, eigener outbound Cloudflare-Tunnel. Prod-Deploy-Pfad unverändert. Windows-Tooling unter `deploy/rtx-staging/`. |
