# UWE Staging auf dem RTX-PC (On-Demand)

Windows-Tooling für eine **getrennte Test-Umgebung** auf dem RTX-PC neben der
Produktion auf dem UWE-Host. `dev` = Staging, `main` = Prod. Der Prod-Host wird
nicht angefasst.

Vollständiges Runbook: [`docs/engineering/staging-rtx.md`](../../docs/engineering/staging-rtx.md).

## Dateien

| Datei | Zweck |
|-------|-------|
| `uwe-test-up.ps1` | dev pullen, Test-DB migrieren, prod-nah bauen, Studio/Portal/Tunnel starten |
| `uwe-test-down.ps1` | Studio/Portal/cloudflared stoppen (`-Wipe` löscht die Test-DB) |
| `uwe-test.env.example` | Vorlage für `C:\uwe-test\.env` (eigene Secrets!) |
| `cloudflared-config.yml.example` | Tunnel-Config für `%USERPROFILE%\.cloudflared\config.yml` |

## Quick Start

Vorbedingung: Der `dev`-Branch muss auf `origin` existieren
(`git checkout -b dev main && git push -u origin dev`, einmalig).

```powershell
# Einmalig
git clone https://github.com/Nehmo101/UWE.git C:\uwe-test
cd C:\uwe-test; git checkout dev; pnpm install --frozen-lockfile
copy deploy\rtx-staging\uwe-test.env.example .env   # dann Werte + Secrets anpassen
# cloudflared-config.yml.example nach %USERPROFILE%\.cloudflared\config.yml (siehe Runbook)

# Betrieb (aus deploy\rtx-staging)
.\uwe-test-up.ps1            # hochfahren
.\uwe-test-up.ps1 -Fresh     # mit frischer Demo-DB
.\uwe-test-down.ps1          # stoppen
```

Vor dem Konfigurieren den Konfig-Block am Kopf von `uwe-test-up.ps1` (Pfade,
Branch, Tunnel-Name) prüfen. Bei blockierter Ausführungsrichtlinie:
`powershell -ExecutionPolicy Bypass -File .\uwe-test-up.ps1`.
