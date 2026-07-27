---
name: life-brain-retrieval
description: Implement Life Brain embeddings and semantic retrieval for personal knowledge in UWE. Strict RTX-only — no cloud fallback. Use when extending PersonalBrainDocument, PersonalBrainFact, or AI context modes for personal_brain.
---

# Life Brain Retrieval

## Privacy (non-negotiable)

Read `docs/life-brain-privacy.md` before any code change.

| Rule | Detail |
|------|--------|
| Context mode | `personal_brain` is `LOCAL_ONLY_CONTEXT_MODES` |
| Provider | RTX/local only — block if offline |
| Cloud fallback | **Never** — same as DnD/world brain |
| Storage | Personal brain separate from `BrainDocument` (DnD) |
| Portal | Life Brain never in Portal |

Enforcement: `packages/ai-brain/src/router/privacyGuard.ts`, `personal-brain-privacy.test.ts`.

## Existing code to reuse

| DnD Brain (reference) | Life Brain (target) |
|-----------------------|---------------------|
| `BrainDocument`, `BrainChunk` | `PersonalBrainDocument` |
| `BrainFact` | `PersonalBrainFact` |
| `brain-store-service.ts` | Create/extend `personal-brain-service.ts` |
| Embedding + chunk pipeline in `packages/ai-brain/src/brain/` | Mirror patterns, separate tables |

## Implementation steps

```txt
1. Service layer — packages/database/src/personal-brain-service.ts
   - CRUD (may exist via life-admin-service)
   - chunkDocument(), embedChunks(), searchSimilar()
2. Reuse embedding client from ai-brain (RTX endpoint only)
3. Retrieval API for Studio chat / life-brain page
4. Index on document save/update (deferred job or sync)
5. Tests — privacy guard blocks cloud; retrieval smoke with mock embeddings
```

## AI integration

- Context mode `personal_brain` in AI router
- Retrieval results injected only when provider is `local_rtx` or `auto` resolves to local
- User-facing error when RTX offline: clear message, no silent cloud fallback

## Files (typical)

- `packages/database/prisma/schema.prisma` — `PersonalBrainChunk` if needed (migration)
- `packages/database/src/personal-brain-service.ts`
- `packages/ai-brain/src/brain/` — shared utilities only; no mixing DnD/Life data
- `packages/ai-brain/src/router/privacyGuard.ts`
- `apps/studio/app/life-brain/**`

## Migration note

If adding `PersonalBrainChunk`: one migration per PR; review with `database-migration-review` skill.

## Tests

```bash
pnpm --filter @uwe/ai-brain test -- personal-brain
pnpm test:security  # if touching router or API routes
```

## Orchestrator

Do not parallel-edit `privacyGuard.ts` with Mail/Calendar AI work.
