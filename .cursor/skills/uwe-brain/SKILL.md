---
name: uwe-brain
description: Work with UWE DnD Brain and Life Brain — storage, retrieval, embeddings, privacy separation, and AI context loading. Use when extending brain CRUD, personal admin brain, or knowledge retrieval for generators.
---

# UWE Brain (DnD + Life)

## Two brains, strict separation

| Brain | Service | UI | AI context loader |
|-------|---------|-----|-------------------|
| **DnD / Campaign** | `brain-store-service.ts` | `/worlds/[slug]/brain`, `/brain` | `db-brain-knowledge-source.ts` |
| **Life / Personal** | `life-admin-service.ts` (personal brain section) | Daily Admin OS, life brain UI | `loadPersonalBrainPromptContext` |

**Never mix** embeddings, facts, or prompt context between them.

## DnD Brain

- Models: `BrainDocument`, `BrainFact`, chunks for retrieval
- Embeddings: `packages/ai-brain/src/embeddings/**`
- World-scoped — tied to campaign world slug
- Context mode: `brain`, `current_object_plus_brain`
- Canon check: World Inspector + AI `canon_check` — skill: `dnd-content-consistency-check`

## Life Brain

- Models: `PersonalBrainDocument`, `PersonalBrainFact`
- Context mode: `personal_brain` — **local Maschinenraum only**
- No Portal exposure, no cloud provider
- Docs: `docs/life-brain-privacy.md`

## CRUD patterns

- Business logic in `@uwe/database` services — not in Studio pages
- Studio API: `apps/studio/app/api/worlds/[worldSlug]/brain/route.ts`
- AI expansion action: `expand_knowledge` in `packages/ai-brain/src/actions.ts`

## Retrieval for AI

1. Build context in `packages/ai-brain/src/context/context-builder.ts`
2. Respect privacy mode before calling provider
3. Chunk limits — avoid sending entire brain in one prompt

## Adding brain features

1. Schema change → migration + `database-migration-review` skill
2. Extend appropriate service (campaign vs personal — never both in one table)
3. Wire AI task with local-only guard if sensitive
4. Review/Apply for generated facts/documents
5. Tests in |batch service tests + `pnpm test:leaks` if visibility touched

## Related

- Skill: `local-first-privacy`
- Skill: `dnd-content-consistency-check`
- Skill: `ai-agent-proposal-workflow`
- Docs: `docs/life-brain-privacy.md`, `docs/dnd-generator-upgrade.md`
