---
name: ai-agent-proposal-workflow
description: Work with UWE AI inference, Review/Apply proposals, ai_run jobs, Agent Jobs dispatch, and RTX routing. Use when adding brain actions, generator tasks, deferred AI prompts, or GitHub/Cursor agent integration.
---

# UWE AI & Agent Proposal Workflow

## Two agent systems

| System | Purpose | Entry |
|--------|---------|-------|
| **AI Brain** | In-app KI — DnD generator, canon check, session prep | Studio UI, `packages/ai-brain` |
| **Agent Jobs** | Repo development — Cursor/GitHub dispatch | `/admin/agent-jobs`, `docs/AGENT_JOBS.md` |

Do not conflate them — Agent Jobs send **only the manual prompt** to GitHub/Cursor, never world/brain context.

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
| Agent dispatch | `packages/agent-jobs/` |

## RTX offline / deferred

When local-only context and RTX unavailable:

1. Enqueue `ai_run` job with `deferredAiPrompt: true`
2. HTTP **202** + `jobId`
3. **No cloud fallback**
4. Retry on next job run when RTX returns

## Agent Jobs (development)

```bash
pnpm quality   # mandatory before push — see AGENTS.md
```

- `AGENT_JOBS_AUTO_MERGE` must stay **`false`**
- Draft PRs only — human review required
- Workflow: `.github/workflows/cursor-agent.yml`

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
- [ ] Agent Job prompts contain no secrets or world dumps

## Related

- Skill: `local-first-privacy`
- Skill: `uwe-brain`
- Skill: `dnd-content-consistency-check`
- Docs: `docs/AGENT_JOBS.md`, `docs/dnd-generator-upgrade.md`

Details: [references/proposal-states.md](references/proposal-states.md)
