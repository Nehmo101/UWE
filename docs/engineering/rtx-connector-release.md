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
| Workflow | `.github/workflows/uwe-windows-release.yml` (tag push **or** `workflow_dispatch`) |
| Artifacts | NSIS setup (`.exe`), MSI, five `uwe-<app>-X.Y.Z.tar.gz` bundles, `uwe-databases-X.Y.Z.tar.gz`, `uwe-release.json` |
| Stable installer name | `UWE_Command_Center_X.Y.Z_x64-setup.exe` |
| Manifest URL (bundle install) | `https://github.com/Nehmo101/UWE/releases/latest/download/uwe-release.json` |

Der Tag darf **nie** auf einen Commit zeigen, dessen `VERSION` anders lautet:
Der Workflow bricht in diesem Fall ab, bevor er baut. Sonst trüge die App eine
andere Fassung als das Release, und der Update-Check sagte nie „aktuell".

### Publish a Windows release (Tag-Push)

Der reguläre Weg — das Release entsteht aus dem Tag:

1. Version im PR anheben: `VERSION`, root `package.json`,
   `apps/rtx-connector-client/package.json`,
   `apps/rtx-connector-client/src-tauri/tauri.conf.json`,
   `apps/rtx-connector-client/src-tauri/Cargo.toml` und ein `CHANGELOG.md`-Eintrag.
   `scripts/release.test.ts` hält `VERSION`, `tauri.conf.json` und `Cargo.toml`
   auf derselben Fassung.
2. Nach dem Merge auf `main` den Tag setzen und pushen:

   ```bash
   git checkout main && git pull origin main
   git tag uwe-v0.1.0
   git push origin uwe-v0.1.0
   ```

3. Der Workflow läuft an: Version aus dem Tag lesen und gegen `VERSION` prüfen,
   auf `windows-latest` bauen, die fünf App-Bundles und die leeren Datenbanken
   packen, `uwe-release.json` (schemaVersion 2, SHA-256 je Asset) schreiben und
   das Release **am gepushten Tag** veröffentlichen — kein Draft, sonst wäre es
   für `releases/latest/download/` unsichtbar.
4. **Releases**-Seite öffnen und prüfen: Installer, fünf Bundles, Datenbanken,
   `uwe-release.json`.

Ein Tag löschen und neu pushen erzeugt ein neues Release am selben Namen —
Assets werden ersetzt. Eine bereits ausgelieferte Version stattdessen mit einem
neuen Patch-Tag ablösen.

### Publish by hand (`workflow_dispatch`)

Für Wiederholungsläufe (abgebrochener Runner, fehlendes Asset) und Draft-Tests:
**UWE Windows Release** in GitHub Actions starten. Der Tag wird dann aus dem
ausgecheckten Ref erzeugt; die optionale `version`-Eingabe muss `VERSION`
entsprechen. Nur dieser Weg kann `draft: true` setzen.

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
