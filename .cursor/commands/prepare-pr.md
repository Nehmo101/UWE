# Prepare PR

Summarize changes and produce a ready-to-paste PR description for UWE.

## Steps

1. Review `git diff` and recent commits on the branch.
2. Identify affected domains (Studio, Portal, packages, CI, docs).
3. List tests and checks run locally.
4. Note migration steps, ENV changes, or breaking changes.
5. Flag security-sensitive areas for extra reviewer attention.

## PR description template

```markdown
## Summary
<!-- 2-4 sentences: what and why -->

## Changes
- <!-- bullet list of concrete changes -->

## Test plan
- [ ] `pnpm quality` (or list specific scripts run)
- [ ] <!-- manual QA steps if applicable -->

## Risks / migration
<!-- ENV vars, DB migrations, deployment notes — or "None" -->

## Security
<!-- auth, visibility, uploads affected? — or "No security-sensitive changes" -->
```

## Pre-push checklist

- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm quality` passes
- [ ] `pnpm-lock.yaml` committed if dependencies changed
- [ ] Prisma migrations included if schema changed
- [ ] Docs updated for new scripts, commands, or architecture changes
- [ ] No secrets in diff

## Rules

- Draft PRs by default for agent-generated work.
- Link related docs (`docs/engineering/ci.md`, domain docs) when relevant.
