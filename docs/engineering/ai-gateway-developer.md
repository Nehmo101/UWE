# AI Gateway — Developer Notes

## Adding a cloud provider

1. Register in `packages/ai-brain/src/providers/` (OpenAI-family or dedicated adapter).
2. Add to `packages/ai-brain/src/settings.ts` `PROVIDER_DEFINITIONS` if ENV fallback needed.
3. Master-Admin configures via `/admin/ai-gateway` → stored encrypted in `ai_cloud_providers`.
4. Gateway merges DB keys via `createGatewayApiKeyStore()` — **never** expose keys to clients.

## Routing new AI features through the gateway

```typescript
import { executeAiGatewayRequest } from "@uwe/ai-brain";

await executeAiGatewayRequest(deps, {
  user: { userId, role },
  feature: "AI_DND_USE", // or AI_CHAT_USE, AI_IMAGE_USE, …
  providerMode: "auto",
  contextMode: "brain",
  taskType: "summarize_page",
  worldSlug,
  pageSlug,
});
```

Pass `userId` on job enqueue (`EnqueueJobInput.userId`) so background jobs retain permission context.

## Tests

| Area | Path |
|------|------|
| Gateway routing | `packages/ai-brain/src/gateway/gateway.test.ts` |
| Permissions / privacy helpers | `packages/database/src/ai-gateway-service.test.ts` |
| Router privacy | `packages/ai-brain/src/router/router.test.ts` |
| Security routes | `pnpm test:security` |

## Never log or send to client

- `apiKeyEnc` / decrypted API keys
- `RTX_SERVICE_TOKEN`, `CLOUD_AI_API_KEY`, and other provider secrets
- Full prompts with PII in production usage logs (gateway logs metadata only)

## Audit trail

Master-Admin changes (config, providers, grants) → `audit_log` with `targetType: settings`, `targetId: ai-gateway`.

Usage per inference → `ai_usage_logs` (no prompt text).

## Known integration status

| Feature | Gateway |
|---------|---------|
| KI-Prompt | ✅ requires auth user |
| AI generate jobs | ✅ with `job.userId` |
| Brain actions | ✅ with `gatewayUser` |
| Image Studio | ✅ | `executeAiGatewayImageRequest` |
| Research jobs | ✅ | `executeAiGatewayResearchJob` |
| Deferred KI-Prompt | ✅ | `job.userId` required |

Legacy `routeAiRequest()` remains for unit tests when no user context is provided.

Token usage from provider responses is logged when available (`GenerateTextResult.usage`); otherwise char/4 estimation applies.
