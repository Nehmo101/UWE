# AI Brain -> RTX Connector migration notes

Date: 2026-06-26
Status: inventory and follow-up plan

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

## Legacy inbound path still in use

The AI Brain/Gateway code still supports the old inbound RTX Agent model:

- `packages/ai-brain/src/rtx-agent-config.ts` reads `RTX_AGENT_URL`,
  `RTX_AGENT_TOKEN`, `RTX_TIMEOUT_MS` and `PREFERRED_LOCAL_MODEL`.
- `packages/ai-brain/src/router/providers/localRtxProvider.ts` prefers the
  inbound RTX Agent when configured, otherwise direct local inference providers.
- `packages/ai-brain/src/router/health/rtxHealthcheck.ts` reports either RTX
  Agent health or direct inference health.
- `apps/studio/app/api/inference/hardware/route.ts` calls
  `${RTX_AGENT_URL}/api/hardware` directly.

These paths are deprecated but still present for existing setups.

## Pragmatic migration path

Do not rewrite the AI Brain in one step. Add a small adapter service first:

1. Add `packages/ai-brain/src/router/providers/connectorQueueProvider.ts`.
2. It should depend on `createConnectorService(prisma)` from the host process,
   enqueue `llm_generate` / `embedding_generate`, and wait or poll for completion
   behind a bounded timeout.
3. Only enable it when an online connector advertises the required effective
   capability (`llm_local` or `embedding_local`).
4. Keep cloud/privacy rules unchanged; the adapter is only another local provider.
5. Leave `RTX_AGENT_URL` as deprecated compatibility until the queue provider is
   verified in local CI and real host smoke tests.

## Image generation

`image_generate` should stay capability-gated. It is executable only when a local
image worker command is configured. A first-party worker, model selection and UI
status polish remain follow-ups.

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
