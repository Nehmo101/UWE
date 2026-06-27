# AI Brain -> RTX Connector migration notes

Date: 2026-06-27
Status: connector queue provider implemented and wired (P6)

## Current state

The outbound RTX Host Connector queue already has job catalogue entries for:

- `llm_generate`
- `embedding_generate`
- `image_generate`

The connector executor currently runs `llm_generate` and `embedding_generate`
through Ollama only. LM Studio and llama.cpp discovery remains informational for
now; they do not advertise executable `llm_local` or `embedding_local`
capabilities. Cloud providers stay behind the UWE interface/gateway instead of
the RTX connector.

`image_generate` can run through an explicitly configured local command via
`UWE_CONNECTOR_IMAGE_CMD`. There is no bundled first-party image backend yet, so
`image_generation` is not advertised unless that command is configured.

## Connector queue provider (implemented)

Local LLM inference now prefers the outbound RTX Host Connector queue:

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
  the route is `local_rtx` and a connector advertises `llm_local`. The direct
  `createLocalRtxProvider` stays as the fallback when no connector is online.
  `request.useMock` bypasses the connector path.

Cloud/privacy rules are unchanged — the connector is just another local backend.

## Legacy inbound path (renamed / demoted)

- `packages/ai-brain/src/rtx-worker-config.ts` is the canonical resolver for
  `RTX_AGENT_URL` / `RTX_AGENT_TOKEN` / `RTX_TIMEOUT_MS` / `PREFERRED_LOCAL_MODEL`
  (`RtxWorker*` names). `rtx-agent-config.ts` is a deprecated re-export shim that
  keeps the old `RtxAgent*` aliases and the `./rtx-agent-config` package export.
- `apps/studio/app/api/inference/hardware/route.ts` no longer calls
  `${RTX_AGENT_URL}/api/hardware`; it returns **410 Gone** and points to the
  outbound RTX Host Connector (`tools/uwe-rtx-connector`, `system_info`).
- `packages/cookbook/src/recommendations.ts` no longer recommends the legacy
  `rtx_agent` engine — Ollama / OpenAI-compatible / connector only.

The RTX worker security boundary (`@uwe/security` rtx-boundary) and the image
path still resolve/LAN-validate `RTX_AGENT_URL` for existing setups.

## Image generation

`image_generate` stays capability-gated. When `RTX_AGENT_URL` is set, Image
Studio logs a deprecation warning. With `RTX_USE_CONNECTOR_IMAGE=true` and a
host-injected connector bridge, image generation routes through the connector
`image_generate` queue instead of the inbound RTX Agent HTTP call. A first-party
image worker, model selection and UI status polish remain follow-ups.

## Verification target

Before removing or demoting `RTX_AGENT_URL`, run locally:

```bash
pnpm install --frozen-lockfile
pnpm --filter @uwe/database db:generate
pnpm lint
pnpm typecheck
pnpm test:ci
pnpm test:security
pnpm build:release
```
