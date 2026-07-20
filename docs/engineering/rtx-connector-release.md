# UWE Command Center — Windows Releases & Updates

UWE publishes **Windows GitHub Releases** for the Command Center. Installing a
release (or using the in-app Update button) also rolls out UWE itself: the local
git checkout is synced to the release tag and Studio/Portal are rebuilt.

## Release tags

| Item | Value |
|------|-------|
| Tag format | `uwe-vX.Y.Z` (from root `VERSION`) |
| Workflow | `.github/workflows/uwe-windows-release.yml` (manual `workflow_dispatch`) |
| Artifacts | NSIS setup (`.exe`), MSI, `uwe-release.json` |
| Stable installer name | `UWE_Command_Center_X.Y.Z_x64-setup.exe` |

### Publish a Windows release

1. Ensure `VERSION`, root `package.json`, and
   `apps/rtx-connector-client/src-tauri/tauri.conf.json` share the same semver.
2. In GitHub Actions run **UWE Windows Release**.
3. Optional input `version` overrides `VERSION` for the build metadata; prefer
   bumping `VERSION` in a PR first so the tagged commit matches.
4. The workflow builds on `windows-latest`, uploads installers, and creates the
   GitHub Release for tag `uwe-vX.Y.Z`.

Optional signing secrets (recommended before enabling the Tauri auto-updater):

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

The multi-platform artifact workflow
(`.github/workflows/rtx-connector-release.yml`) remains available for Linux/macOS
bundle experiments; **Windows product releases** use `uwe-windows-release.yml`.

## Command Center Update button

In the desktop Command Center:

1. **Nach Updates suchen** — `git fetch` + latest `uwe-v*` tag (fallback:
   `origin/main`).
2. **Update installieren** —
   - stops Studio/Portal if running
   - stashes dirty worktree changes
   - checks out the release tag (or fast-forwards `main`)
   - runs the full local setup (deps, migrate, seed-if-needed, production builds)
   - restarts services when they were running
   - opens the Windows Command Center installer when the app version is behind

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
