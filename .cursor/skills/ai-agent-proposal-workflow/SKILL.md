---
name: ai-agent-proposal-workflow
description: Work with UWE AI inference, Review/Apply proposals, ai_run jobs, and RTX routing. Use when adding brain actions, generator tasks, or deferred AI prompts.
---

# UWE AI & Agent Proposal Workflow

## Scope

In-app KI only — DnD generator, canon check, session prep (Studio UI,
`packages/ai-brain`). Repo development runs outside UWE on GitHub; UWE itself
dispatches no coding agents.

## AI proposal flow (in-app)

```txt
User prompt → AI router (privacy guards) → Provider (RTX or cloud)
    → Proposal saved (idea/draft/dm_only)
    → DM reviews in UI
    → Explicit Apply → canon/page/brain update
```

**Never auto-canonize** AI output. Cloud providers only for `general_chat` — no campaign/brain context.

## Key files

| Area | Path |
|------|------|
| Router | `packages/ai-brain/src/router/aiRouter.ts` |
| Privacy guards | `packages/ai-brain/src/router/types.ts`, validation helpers |
| Actions / tasks | `packages/ai-brain/src/actions.ts`, `tasks.ts` |
| Review service | `packages/database/src/ai-review-service.ts` |
| Job queue | `packages/database/src/job-service.ts` |

## RTX offline / deferred

When local-only context and RTX unavailable:

1. Enqueue `ai_run` job with `deferredAiPrompt: true`
2. HTTP **202** + `jobId`
3. **No cloud fallback**
4. Retry on next job run when RTX returns

## Adding a new AI task

1. Define task in `packages/ai-brain/src/tasks.ts` or action in `actions.ts`
2. Set context mode — local-only if logistics in `LOCAL_ONLY_CONTEXT_MODES`
3. Route through `aiRouter` with privacy validation
4. Persist as proposal — wire Review/Apply UI or existing review service
5. Tests: `packages/ai-brain/src/**/*.test.ts`, security if new API route

## Checklist

- [ ] Player-safe tasks cannot receive GM secrets
- [ ] Local-only modes never fall back to cloud
- [ ] New inference API route has auth + rate limit
- [ ] Output visibility defaults to `dm_only` or `draft`

## Related

- Skill: `local-first-privacy`
- Skill: `uwe-brain`
- Skill: `dnd-content-consistency-check`
- Docs: `docs/dnd-generator-upgrade.md`

Details: [references/proposal-states.md](references/proposal-states.md)
