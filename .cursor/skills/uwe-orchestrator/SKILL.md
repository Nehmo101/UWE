---
name: uwe-orchestrator
description: Coordinate UWE product evolution across Daily Admin OS, DnD Studio, Portal, and integrations. Use when planning multi-domain work, delegating to subagents, or sequencing PRs for the Alltags- und Hobby-Betriebssystem vision.
---

# UWE Product Orchestrator

## Before delegating

1. Read `docs/engineering/product-orchestrator-plan.md` — source of truth for order and work packages.
2. Read `docs/FEATURE_MATURITY_MATRIX.md` — honest feature status.
3. Check conflict matrix — do not run parallel subagents on same files (`privacyGuard.ts`, `life-admin-service.ts`, `schema.prisma`).
4. Confirm product boundaries: **no** family/meal/cat/household modules (`docs/prompts/UWE_DAILY_ADMIN_OS_CURSOR_PROMPTS.md`).

## Non-negotiable rules

| Rule | Enforcement |
|------|-------------|
| Cloud AI gets no brain/world/life/campaign context | `packages/ai-brain/src/router/privacyGuard.ts` — **`personal_brain` hard local**; DnD/world configurable via AI Gateway privacy matrix (W0) |
| AI outputs = Proposal/Draft/Run — never auto-apply | AI Runs, Generator, Life Brain |
| Portal filters visibility server-side | `packages/database/src/permissions.ts`, `pnpm test:security` |
| RTX never public | LAN only, `DEPLOYMENT_SECURITY.md` |
| Daily Admin data stays in Studio | No Portal routes for Capture/Life Brain |
| Small PRs | One subagent domain per branch |

## Subagent dispatch checklist

```txt
[ ] Relevant skill read (.cursor/skills/)
[ ] Existing files located (grep, REPO_AUDIT.md)
[ ] Branch: cursor/<descriptive-name>-adcf
[ ] Scope limited to work package in orchestrator plan
[ ] Tests planned
[ ] No parallel edit of conflict files
[ ] pnpm quality before push
[ ] Draft PR with summary
```

## Recommended phase order

1. Skills & Architecture Foundation
2. Today, Capture, Workshop, Hardware (parallel, separate paths)
3. Life Brain Retrieval (exclusive on AI privacy router)
4. Calendar & Mail → Today calendar merge
5. Portal Session Experience + Co-DM Review (parallel)
6. Image Studio (after Capture upload)
7. Performance / Tags / CI (last)

## Skills map by domain

| Domain | Skill |
|--------|-------|
| Daily Admin OS (Today, Capture, Projects, Workshop, Contracts, Hardware) | `daily-admin-os` |
| Life Brain embeddings/retrieval | `life-brain-retrieval` |
| Image Studio, assets, labels | `image-studio-workflows` |
| Feature implementation (general) | `uwe-feature-implementation` |
| CI before PR | `ci-quality-gate` |
| Security-sensitive changes | `security-audit` |
| Prisma migrations | `database-migration-review` |
| Portal/player safety | `security-audit`, `dnd-content-consistency-check` |

## Output template (per subagent completion)

```markdown
## Subagent [N]: [Name]

### Changed files
- ...

### Decisions
- ...

### Tests
- ...

### Risks / follow-ups
- ...

### Next recommended subagent
- ...
```
