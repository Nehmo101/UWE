# AI Brain -> RTX Connector migration notes

Date: 2026-06-26
Status: inventory and follow-up plan

## Current state

The outbound RTX Host Connector queue already has job catalogue entries for:

- `llm_generate`
- `embedding_generate`
- `image_generate`

The connector executor currently runs `llm_generate` and `embedding_generate`
through Ollama only. `image_generate` exists in the catalogue but fails honestly
because no image executor is configured.

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

`image_generate` should stay behind a follow-up until an executor exists. Do not
advertise `image_generation` and do not show runtime status that suggests the
connector can generate images.

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
