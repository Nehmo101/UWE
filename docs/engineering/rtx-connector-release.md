# UWE Command Center — Windows Releases & Updates

UWE publishes **Windows GitHub Releases** for the Command Center. Installing a
release (or using the in-app Update button) also rolls out UWE itself: the local
git checkout is synced to the release tag and Studio/Portal are rebuilt.

## Release tags

Der Release-Tag ist der **Vertrag** mit dem Command Center. Er ist die einzige
Angabe, aus der beide Update-Wege ihre Wahrheit ziehen:

| Item | Value |
|------|-------|
| Tag format | `uwe-vX.Y.Z` (must equal root `VERSION` on the tagged commit) |
| Wer setzt den Tag | die Pipeline (`workflow_dispatch`); ein bereits vorhandener Tag darf auch gepusht werden |
| Workflow | `.github/workflows/uwe-windows-release.yml` (`workflow_dispatch` **oder** Push eines `uwe-v*`-Tags) |
| Version setzen | `pnpm release:version X.Y.Z --pr` (fünf Dateien + CHANGELOG + Branch + Commit), Prüfung: `pnpm release:version --check` |
| Artifacts | NSIS setup (`.exe`), MSI, five `uwe-<app>-X.Y.Z.tar.gz` bundles, `uwe-databases-X.Y.Z.tar.gz`, `uwe-release.json` |
| Stable installer name | `UWE_Command_Center_X.Y.Z_x64-setup.exe` |
| Manifest URL (bundle install) | `https://github.com/Nehmo101/UWE/releases/latest/download/uwe-release.json` |

Der Tag darf **nie** auf einen Commit zeigen, dessen `VERSION` anders lautet:
Der Workflow bricht in diesem Fall ab, bevor er baut. Sonst trüge die App eine
andere Fassung als das Release, und der Update-Check sagte nie „aktuell".

### Publish a Windows release (der reguläre Weg)

**Den Tag erzeugt die Pipeline, nicht die Hand.** Es gibt genau zwei Schritte:

1. **Versions-PR.** Ein Befehl bereitet alles vor, was maschinell bestimmbar ist:

   ```bash
   pnpm release:version 0.2.0 --pr
   ```

   Das setzt die fünf Fassungsangaben (`VERSION`, root `package.json`,
   `apps/rtx-connector-client/package.json`, `…/src-tauri/tauri.conf.json`,
   `…/src-tauri/Cargo.toml`), macht aus dem `CHANGELOG.md`-Abschnitt
   `[Unreleased]` die Fassung `[0.2.0] - <heute>` und stellt ein leeres
   `[Unreleased]` darüber, legt `release/v0.2.0` an und committet als
   `chore(release): v0.2.0`.

   Zwei Dinge macht es bewusst **nicht**: pushen, und den CHANGELOG-Text
   schreiben. Der bisherige Unreleased-Inhalt wandert unverändert mit — kürzen
   und sortieren, dann `git commit --amend -a`, pushen, mergen.

   Es bricht ab, wenn der Arbeitsbaum nicht sauber ist, der Branch schon
   existiert oder die Fassung bereits im CHANGELOG steht — im letzten Fall bevor
   ein Branch entsteht. `pnpm release:version 0.2.0` ohne `--pr` schreibt nur die
   fünf Dateien (das ist der Pfad, den der Release-Build benutzt);
   `pnpm release:version --check` findet Drift.

   Der Bump geht absichtlich durch einen PR: `main` ist protected, ein
   Workflow-Commit bräuchte ein Bypass-Token — und der CHANGELOG-Text gehört ins
   Review, weil ihn keine Automatisierung schreiben kann.

2. **Pipeline starten.** In GitHub Actions **UWE Windows Release** ausführen
   (Ref: `main`). Der Lauf liest `VERSION`, baut auf `windows-latest`, packt die
   fünf App-Bundles und die leeren Datenbanken, schreibt `uwe-release.json`
   (schemaVersion 2, SHA-256 je Asset) und **legt dabei den Tag `uwe-vX.Y.Z`
   an** — `softprops/action-gh-release` erzeugt ihn am gebauten Commit, wenn er
   noch nicht existiert. Die optionale `version`-Eingabe muss `VERSION`
   entsprechen; nur dieser Weg kann `draft: true` setzen.

3. **Releases**-Seite prüfen: Installer, fünf Bundles, Datenbanken,
   `uwe-release.json`.

### Zweiter Eingang: vorhandener Tag

Existiert der Tag schon — aus einem früheren Lauf, von Hand gesetzt, oder weil
ein Release nachgebaut werden muss —, genügt sein Push:

```bash
git push origin uwe-v0.2.0
```

Der Workflow reagiert auf `uwe-v*` und baut das Release **an genau diesem Tag**.
Er liest die Version dann aus dem Tag und bricht ab, wenn der getaggte Commit
eine andere `VERSION` trägt: ein Release, dessen App sich anders benennt als ihr
Tag, wäre für den Update-Check nicht reparierbar.

Nie ein Draft auf diesem Weg — `releases/latest/download/` kennt nur
veröffentlichte Releases, und genau dort holt die Bundle-Installation ihr
Manifest.

Ein Tag löschen und neu pushen ersetzt die Assets des gleichnamigen Releases.
Eine bereits ausgelieferte Version stattdessen mit einem neuen Patch-Tag
ablösen.

Optional signing secrets (recommended before enabling the Tauri auto-updater):

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

The multi-platform artifact workflow
(`.github/workflows/rtx-connector-release.yml`) remains available for Linux/macOS
bundle experiments; **Windows product releases** use `uwe-windows-release.yml`.

## Command Center Update button

Ein Knopf, zwei Welten. Welche gilt, entscheidet `detectHostMode()`: liegt eine
`pnpm-workspace.yaml` neben der Installation, ist es ein Monorepo-Checkout, sonst
eine Bundle-Installation.

### Monorepo-Checkout (Entwicklermodus)

1. **Nach Updates suchen** — `git fetch origin --tags` + höchster `uwe-v*`-Tag
   (Fallback: `origin/main`, wenn es noch keinen Tag gibt).
2. **Update installieren** —
   - stoppt Studio/Portal, falls sie laufen
   - sichert lokale Änderungen per `git stash`
   - checkt den Release-Tag aus (oder fährt `main` per Fast-Forward nach)
   - fährt das vollständige lokale Setup (deps, migrate, seed-if-needed, Builds)
   - startet die Dienste neu, wenn sie liefen
   - öffnet den Windows-Installer, wenn die Desktop-App hinter dem Tag liegt

### Bundle-Installation (ausgelieferter Zustand)

Hier gibt es **kein git und keinen Checkout** — der Release-Tag kommt über
HTTPS. `Nach Updates suchen` lädt `uwe-release.json` des neuesten Releases und
vergleicht `installed-release.json` damit: die Version und die SHA-256 je
App-Bundle. `Update installieren` lädt nur die Bundles mit geänderter Prüfsumme,
sichert vorher die Datenbanken, migriert und öffnet den Installer, wenn die
Desktop-App hinter dem Release liegt.

Die Fassung der laufenden App reicht der Rust-Host als
`UWE_COMMAND_CENTER_VERSION` (aus `CARGO_PKG_VERSION`) an die Host-CLI durch —
eine Bundle-Installation hat keine `tauri.conf.json` neben sich. Fehlt die
Variable, öffnet der Update-Lauf **keinen** Installer: ein ungefragt gestarteter
Installer wäre schlimmer als ein fehlender Hinweis.

Weder Check noch Update brauchen die `gh`-CLI oder ein Token — der
Installer-Dateiname steht im Manifest.

CLI (same orchestrator the UI uses):

```powershell
node tools/uwe-host-command-center/src/desktop-host-cli.ts check-update --root C:\git\UWE
node tools/uwe-host-command-center/src/desktop-host-cli.ts update --root C:\git\UWE
```

Data and uploads stay under `%LOCALAPPDATA%\UWE\rtx-connector-client\host` and
are not overwritten by the git sync.

## Tauri auto-updater (optional, signed)

Auto-updates stay **disabled** until code signing and a release feed are
configured.

1. Generate a Tauri updater keypair:

   ```bash
   pnpm tauri signer generate -w ~/.tauri/uwe-rtx-connector.key
   ```

2. Set the **public** key in `apps/rtx-connector-client/src-tauri/tauri.conf.json`
   → `plugins.updater.pubkey`.

3. Configure release artifacts + `latest.json` (see `updater/latest.json.example`).

4. Point `plugins.updater.endpoints` at the HTTPS feed for the release tag, e.g.:

   ```json
   "endpoints": ["https://github.com/Nehmo101/UWE/releases/download/uwe-v0.1.0/latest.json"]
   ```

5. Flip `"active": true` and `"dialog": true` after the first signed release.

Until then, the explicit **Update installieren** button is the supported path.

## Homelab E2E

```bash
# Connector client web preview / Tauri dev URL
UWE_E2E_TAURI=1 UWE_CONNECTOR_CLIENT_URL=http://127.0.0.1:1420 \
  pnpm test:e2e e2e/rtx-connector-client.spec.ts

# Label print with stub print command on the RTX host
UWE_CONNECTOR_PRINT_CMD="node ./scripts/e2e-stub-print.mjs" \
UWE_E2E_LABEL_PRINT=1 pnpm test:e2e e2e/studio-label-print.spec.ts
```
