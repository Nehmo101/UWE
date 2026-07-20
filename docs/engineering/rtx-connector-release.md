# UWE Command Center — release & auto-updater

The Tauri desktop client ships multi-target bundles (`msi`, `nsis`, `deb`, `appimage`, `dmg`, `app`).
Auto-updates stay **disabled** until code signing and a release feed are configured.

## Enable the updater

1. Generate a Tauri updater keypair (keep the private key in GitHub Actions secrets):

   ```bash
   pnpm tauri signer generate -w ~/.tauri/uwe-rtx-connector.key
   ```

2. Set the **public** key in `apps/rtx-connector-client/src-tauri/tauri.conf.json` → `plugins.updater.pubkey`.

3. Configure release artifacts + `latest.json` (see `updater/latest.json.example`).

4. Set `plugins.updater.endpoints` to your HTTPS feed, e.g.:

   ```json
   "endpoints": ["https://github.com/Nehmo101/UWE/releases/download/rtx-connector-v0.1.0/latest.json"]
   ```

5. Flip `"active": true` and `"dialog": true` in `tauri.conf.json` after the first signed release exists.

## Release workflow

Run **RTX Connector Release** (`.github/workflows/rtx-connector-release.yml`) via `workflow_dispatch`.
It builds the client on the matching OS runner and uploads bundle artifacts. Signing steps are documented
in the workflow comments — wire Windows Authenticode / Apple notarization before enabling the updater.

## Homelab E2E

```bash
# Connector client web preview / Tauri dev URL
UWE_E2E_TAURI=1 UWE_CONNECTOR_CLIENT_URL=http://127.0.0.1:1420 \
  pnpm test:e2e e2e/rtx-connector-client.spec.ts

# Label print with stub print command on the RTX host
UWE_CONNECTOR_PRINT_CMD="node ./scripts/e2e-stub-print.mjs" \
UWE_E2E_LABEL_PRINT=1 pnpm test:e2e e2e/studio-label-print.spec.ts
```
