# RTX Connector review roadmap (Phases 0–5 + follow-up waves)

Date: 2026-07-06 · Source: Bestandsaufnahme review + follow-up implementation.

## Overview

| Phase / Wave | Focus | Status |
|--------------|--------|--------|
| 0 | Security blockers | ✅ #490 |
| 1 | Connector routing (image, embeddings, readiness) | ✅ #491 |
| 2 | Unified RTX readiness UI + docs | ✅ #492 |
| 3 | Config / governance | ✅ #494 |
| 4 | Tests / executor parity (partial) | ✅ #494 |
| 5 | Legacy refactor (partial) | ✅ #494 |
| **Wave 1** | LM Studio executor, HTTP smoke, HF writer test | ✅ #495 |
| **Wave 2** | Stub image worker, Tauri bridge tests | ✅ #495 |
| **Wave 3** | Multi-target bundles, updater scaffold | ✅ #495 |
| **Wave 4** | Legacy `RTX_AGENT_*` removal | ✅ #495 |
| **Follow-up** | Vision, studio stack E2E, image worker, legacy image HTTP removal, homelab E2E, updater pipeline | ✅ #497 |

## Follow-up (completed) — #497

### Studio HTTP stack E2E (CI)

- `tools/uwe-rtx-connector/src/connector-studio-stack.test.ts` — real `createConnectorService` + HTTP routes + `HostClient` + `executeJob` + `waitForConnectorJob`

### LM Studio / llama.cpp vision

- `runOpenAiCompatibleVision()` in `openai-compatible-llm.ts`
- `vision_extract` routes by enabled profile provider (Ollama + OpenAI-compatible)
- `runConnectorVisionExtract()` in `connectorQueueProvider.ts`; Scan Inbox uses it

### Production image worker

- `scripts/image-worker.mjs` — bundled worker with optional `UWE_IMAGE_BACKEND_URL` proxy
- `stub-image-worker.mjs` returns connector-compatible `{ image, mime_type }` base64

### Connector-only image path

- Removed direct inbound `RTX_BASE_URL` `/v1/images` fallback from `@uwe/image-studio`
- Local images require outbound connector `image_generate` bridge

### Homelab E2E (gated)

- `e2e/studio-label-print.spec.ts` — physical flow when `UWE_E2E_LABEL_PRINT=1`
- `e2e/rtx-connector-client.spec.ts` — Tauri/web client when `UWE_E2E_TAURI=1`
- `scripts/e2e-stub-print.mjs` — stub print command for homelab runs

### Tauri updater + release pipeline

- `tauri-plugin-updater` registered; `plugins.updater.active` stays `false` until signing secrets exist
- `.github/workflows/rtx-connector-release.yml` — manual release scaffold
- `docs/engineering/rtx-connector-release.md` — signing + `latest.json` checklist

## Wave 1 — Executor + CI smoke ✅

- **LM Studio / llama.cpp**: `openai-compatible-llm.ts` + executor routing via enabled profile provider
- **Capability gating**: `local-capabilities.ts` advertises `llm_local` / `embedding_local` for all executable providers
- **HTTP live smoke**: `connector-http-smoke.test.ts` (mock host + `HostClient` cycle)
- **HF download**: writer-stream failure regression test

## Wave 2 — Image backend + Tauri tests ✅

- **Bundled stub**: `tools/uwe-rtx-connector/scripts/stub-image-worker.mjs` documented in `.env.example`
- **Tauri**: existing `tauri.test.ts` bridge coverage retained (invoke + mock backend)

## Wave 3 — Packaging ✅

- **Multi-target bundles**: `tauri.conf.json` — `msi`, `nsis`, `deb`, `appimage`, `dmg`, `app`
- **Updater scaffold**: `plugins.updater` disabled until release signing is configured

## Wave 4 — Legacy env removal ✅

- **`RTX_BASE_URL` / `RTX_SERVICE_TOKEN` only** in runtime resolvers (`rtx-worker-config`, `packages/env`, security boundary, integrations, studio-security)
- **Removed** `packages/ai-brain/src/rtx-agent-config.ts` shim and `isRtxAgentConfigured` exports
- **Health** blocked-worker case uses `source: "inference"` (no `"agent"` lane)
- **Secret redaction** still scans `RTX_AGENT_TOKEN` in logs for backward-compatible host `.env` files

## Still open (future work)

- Enable Tauri **auto-updater** after release signing (`plugins.updater.active=true`)
- Full connector stack E2E in CI without mock host (optional hardening)
- Real GPU image backend via `UWE_IMAGE_BACKEND_URL` proxy to ComfyUI/SD

## Verification

```bash
pnpm ci:light
pnpm test:security
# Homelab (optional):
UWE_E2E_LABEL_PRINT=1 pnpm test:e2e e2e/studio-label-print.spec.ts
UWE_E2E_TAURI=1 pnpm test:e2e e2e/rtx-connector-client.spec.ts
```
