# RTX Connector review roadmap (Phases 0–5)

Date: 2026-07-06 · Source: Bestandsaufnahme review (`docs/audits/rtx-connector-bestandsaufnahme-review.md`) + follow-up PRs.

## Overview

| Phase | Focus | PR |
|-------|--------|-----|
| 0 | Security blockers (print IDOR, unauthenticated heartbeat) | #490 |
| 1 | Connector routing (image bridge, embeddings, readiness, env) | #491 |
| 2 | Unified RTX readiness UI + docs | #492 |
| 3 | Config / governance | (this branch) |
| 4 | Tests / executor parity | (this branch) |
| 5 | Long-term refactor / deprecation | (this branch) |

## Phase 0 — Security ✅

- Print-document IDOR: `assertConnectorPrintDocumentAccess` in label print queue
- Heartbeat auth before paused-queue host config leak

## Phase 1 — Connector routing ✅

- `runConnectorImageGenerate` / `RTX_USE_CONNECTOR_IMAGE` bridge
- Embeddings via connector queue
- `checkRtxReadiness` unified across gateway, mail, cookbook, local RTX
- Canonical env: `RTX_BASE_URL` / `RTX_SERVICE_TOKEN` (legacy aliases kept)

## Phase 2 — UI / docs ✅

- `loadStudioRtxDisplayState` + `RtxStatusBadge` on health, mail, AI chips, Life Brain
- Homelab tile `rtx_connector`, settings/integrations Image Studio status
- Cookbook strings → `/admin/ai-gateway` + `/system/rtx-connector`

## Phase 3 — Config / governance ✅ (this branch)

- **Host capability allowlist UI** on `/system/rtx-connector` (`ConnectorCapabilityGovernance`)
- **Admin API**: `PATCH /api/admin/connectors/[id]` action `set-allowed-capabilities`
- **Image Studio status**: `connectorImageEnabled`, `localImageBackendReady` in settings/integrations
- **Env messaging**: cookbook + rtx-boundary prefer `RTX_BASE_URL` / `RTX_SERVICE_TOKEN` in errors

## Phase 4 — Tests / executor parity ✅ (this branch)

- **CI host smoke**: `packages/database/src/connector-host-smoke.test.ts` (register → heartbeat → enqueue → claim → complete)
- **Audio executor parity**: `audio-player.ts` tracks processes; `sound_stop` / `sound_stop_all` / `sound_volume` no longer no-op acks
- **Security regression**: admin governance route guarded

### Still open (separate features)

- Live Worker process E2E in CI (requires headless connector binary + timing)
- LM Studio / llama.cpp executors (discovery-only today)
- Bundled image backend (`UWE_CONNECTOR_IMAGE_CMD` still required)
- Tauri desktop UI automated tests
- Label-print physical E2E (`UWE_E2E_LABEL_PRINT=1`)

## Phase 5 — Long-term refactor (partial, this branch)

- Legacy alias **messages** updated; aliases **not removed** until full `pnpm quality` gate on production hosts
- Design-system `RtxStatusBadge` deprecated in favour of `@uwe/shared-ui`
- Removal gate documented in `docs/ai-brain-connector-migration.md`

### Deferred until connector-first production default

- Drop `RTX_AGENT_URL` / `RTX_AGENT_TOKEN` mirror in `packages/env`
- Remove `packages/ai-brain/src/rtx-agent-config.ts` shim
- Retire direct inbound RTX worker HTTP for images (connector-only local path)
- Collapse health `source: "agent"` lane into connector + direct inference only

## Verification

```bash
pnpm ci:light
pnpm test:security   # after connector/security changes
```

Full alias removal gate: `pnpm quality` (see `docs/ai-brain-connector-migration.md`).
