# AI Brain -> Maschinenraum migration notes

Date: 2026-06-27
Status: connector queue provider implemented; direct/hybrid transport available

## Current state

The outbound Maschinenraum queue already has job catalogue entries for:

- `llm_generate`
- `embedding_generate`
- `image_generate`

The connector executor currently runs `llm_generate` and `embedding_generate`
through Ollama only. LM Studio and llama.cpp discovery remains informational for
now; they do not advertise executable `llm_local` or `embedding_local`
capabilities. Cloud providers stay behind the UWE interface/gateway instead of
the Maschinenraum connector.

`image_generate` can run through an explicitly configured local command via
`UWE_CONNECTOR_IMAGE_CMD`. There is no bundled first-party image backend yet, so
`image_generation` is not advertised unless that command is configured.

## Queue, direct, and hybrid delivery

The connector transport is selected with
`UWE_CONNECTOR_TRANSPORT=queue|direct|hybrid`. `queue` preserves the existing
database-backed `ConnectorJob` flow. `direct` sends inference work immediately
over the connector's outbound Streaming-HTTP/NDJSON channel and creates no
`ConnectorJob` row. `hybrid` may fall back to the queue only when direct
delivery fails before `accepted`; after acceptance it must surface the direct
result/error and never duplicate the work.

The direct registry is process-local and currently assumes one Studio process.
A multi-process Studio deployment needs a shared broker/session registry or
equivalent connection affinity before relying on direct delivery.

## Connector queue provider (implemented)

Local LLM inference now prefers the outbound Maschinenraum queue:

- `packages/ai-brain/src/router/providers/connectorQueueProvider.ts`
  - `isConnectorLlmAvailable(prisma)` / `isConnectorEmbeddingAvailable(prisma)` —
    true when an online connector advertises `llm_local` / `embedding_local`.
  - `runConnectorLlmGenerate` / `runConnectorEmbeddingGenerate` — enqueue an
    `llm_generate` / `embedding_generate` job and poll until it completes (max
    120s, 500ms interval) via `waitForConnectorJob`.
  - `tryConnectorLlmGenerate` — used by the router: returns `null` when no
    connector advertises `llm_local` so the caller falls back to the direct
    local provider; otherwise resolves the model (explicit request model →
    `ConnectorWorkflowService` slot default → resolved fallback), runs the job
    and returns a `GenerateTextResult`.
- `packages/database/src/connector-service.ts` adds `waitForConnectorJob`
  (and `ConnectorJobWaitError`) — the host observes the job row; an online
  connector claims and completes it. Injectable `now`/`sleep` keep tests fast.
- `packages/ai-brain/src/router/aiRouter.ts` prefers the connector queue when
  the route is `local_engine` and a connector advertises `llm_local`. The direct
  `createLocalEngineProvider` stays as the fallback when no connector is online.
  `request.useMock` bypasses the connector path.

Cloud/privacy rules are unchanged — the connector is just another local backend.

## Legacy inbound path (renamed / demoted)

- `packages/ai-brain/src/engine-worker-config.ts` is the canonical resolver for the
  Maschinenraum worker URL/token, timeout and preferred local model (`EngineWorker*` names).
  `engine-agent-config.ts` is a deprecated re-export shim that keeps the old
  `EngineAgent*` aliases and the `./engine-agent-config` package export for existing
  imports.
- `apps/studio/app/api/inference/hardware/route.ts` no longer calls the old
  inbound agent hardware endpoint; it returns **410 Gone** and points to the
  outbound Maschinenraum (`tools/uwe-engine-connector`, `system_info`).
- `packages/cookbook/src/recommendations.ts` no longer recommends the legacy
  `engine_agent` engine — Ollama / OpenAI-compatible / connector only.

The Maschinenraum worker security boundary (`@uwe/security` engine-boundary) and the image
path still resolve/LAN-validate the worker URL for existing setups. New docs and
examples should use `ENGINE_BASE_URL` / `ENGINE_SERVICE_TOKEN`.

## Image generation

`image_generate` stays capability-gated. When the direct worker URL is configured,
Image Studio logs a deprecation warning for the old inbound path. With
`ENGINE_USE_CONNECTOR_IMAGE=true` and a host-injected connector bridge, image
generation routes through the connector `image_generate` queue instead of the
inbound HTTP call. A first-party image worker, model selection and UI status polish
remain follow-ups.

## Verification target

Before removing the legacy env alias compatibility in code, run locally:

```bash
pnpm install --frozen-lockfile
pnpm --filter @uwe/database db:generate
pnpm lint
pnpm typecheck
pnpm test:ci
pnpm test:security
pnpm build:release
```

## Review roadmap status (2026-07-06)

Phases 0–2 shipped in PRs #490–#492. Phase 3–5 work (governance UI, host smoke tests,
audio stop executor, env message cleanup) continues on `cursor/phase3-5-connector-roadmap-98ef`.
See `docs/engine-connector.md` for the full checklist and remaining
deferred items (LM Studio executor, bundled image worker, live Worker CI E2E).
