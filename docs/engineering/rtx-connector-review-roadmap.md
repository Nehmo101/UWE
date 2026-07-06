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
| **Wave 1** | LM Studio executor, HTTP smoke, HF writer test | ✅ |
| **Wave 2** | Stub image worker, Tauri bridge tests | ✅ |
| **Wave 3** | Multi-target bundles, updater scaffold | ✅ |
| **Wave 4** | Legacy `RTX_AGENT_*` removal | ✅ |

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

- **`RTX_BASE_URL` / `RTX_SERVICE_TOKEN` only** in runtime resolvers (`rtx-worker-config`, `packages/env`, security boundary, image-studio, integrations, studio-security)
- **Removed** `packages/ai-brain/src/rtx-agent-config.ts` shim and `isRtxAgentConfigured` exports
- **Health** blocked-worker case uses `source: "inference"` (no `"agent"` lane)
- **Secret redaction** still scans `RTX_AGENT_TOKEN` in logs for backward-compatible host `.env` files

## Still open (future work)

- Live Worker binary + Studio HTTP E2E in CI (full stack, not mock host)
- LM Studio / llama.cpp **vision** via OpenAI multimodal messages
- Production **bundled** image backend beyond stub worker
- Tauri **WebView** / Windows-homelab E2E
- Label-print physical E2E (`UWE_E2E_LABEL_PRINT=1`)
- Enable Tauri **auto-updater** after signing + release pipeline
- Retire direct inbound worker HTTP for images (connector-only path)

## Verification

```bash
pnpm ci:light
pnpm test:security
```
