---
name: uwe-feature-implementation
description: Implement new UWE features following monorepo conventions — domain logic in packages, thin Next.js apps, Prisma migrations, tests, and player-safety rules. Use when building Studio/Portal features, Daily Admin OS modules, AI/Brain actions, or extending shared packages.
---

# UWE Feature Implementation

## Before coding

1. Read [references/architecture.md](references/architecture.md) for repo layout — or skill `uwe-architecture` for full package map.
2. Identify the **package** vs **app** boundary — logic belongs in `packages/`, UI/routes in `apps/`.
3. Check existing services before adding new abstractions.
4. For AI features: enforce Review/Apply (no auto-canonization).
5. For collaborative edits: Co-DM and player contributions use `ContentReview` queue — see `docs/engineering/roles-review-workflow.md`.

## Implementation steps

```txt
1. Schema (if needed) → prisma/schema.prisma + migration
2. Domain service → packages/database/src/ or feature package
3. API route / Server Action → apps/studio or apps/portal
4. UI page/component → apps/*/app/**
5. Tests → co-located *.test.ts in package
6. Docs → docs/ only if user-facing behavior changes
```

## Quality gate

```bash
pnpm file-size:check   # seconds — run before the full gate
pnpm lint && pnpm typecheck && pnpm test && pnpm build:release
```

Add `pnpm test:security` when touching auth, visibility, or API routes.

## Module size (CI blocker)

New production files (`apps/`, `packages/`, `tools/`) must stay **under 700 lines**. Split at ~500 lines — do not wait for CI. Legacy files in `scripts/file-size-baseline.json` are frozen; extract code instead of growing them.

## HTML sanitization / mail routes

Never top-level-import `isomorphic-dompurify` or `jsdom`. Lazy-init inside a function and list both in `apps/studio/next.config.ts` → `serverExternalPackages`. Reference: `apps/studio/src/lib/sanitize-html.ts`.

## Conventions

| Topic | Rule |
|-------|------|
| **Imports** | Apps import from `@uwe/database`, `@uwe/auth`, etc. — not cross-app |
| **Visibility** | Use `Visibility`, `PublishStatus`, `CanonicalStatus` enums |
| **Player content** | Filter server-side; never never trusts client |
| **AI output** | Save as `idea` / `draft` / `dm_only` — explicit Apply to canonize |
| **ENV** | Extend `.env.example`; validate via `@uwe/env` |
| **Scope** | Minimal diff; match surrounding naming and patterns |

## Daily Admin OS

Use skill `daily-admin-os` for Today, Capture, Workshop, Hardware, etc.

Follow product boundaries in `docs/prompts/UWE_DAILY_ADMIN_OS_CURSOR_PROMPTS.md` — no family/meal/cat modules.

## Life Brain / Image Studio / Calendar / Mail

| Area | Skill or doc |
|------|----------------|
| Life Brain retrieval | `life-brain-retrieval`, `docs/life-brain-privacy.md` |
| Image Studio | `image-studio-workflows`, `docs/IMAGE_STUDIO.md` |
| Calendar | `docs/CALENDAR_INTEGRATION.md` |
| Mail | `docs/ai-brain-mail/README.md` |
| Multi-domain rollout | `docs/engineering/product-orchestrator-plan.md` |

Details: [references/architecture.md](references/architecture.md)

## Capture 2.0

See [references/capture-patterns.md](references/capture-patterns.md) for inbox, triage, proposals, and file upload conventions.
