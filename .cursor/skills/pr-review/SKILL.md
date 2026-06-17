---
name: pr-review
description: Review UWE pull requests for correctness, security, CI readiness, and merge safety. Use when reviewing PRs, draft PRs from Agent Jobs, security hardening batches, or before merging to main.
---

# UWE PR Review

## Quick start

1. Read the PR diff and description; note whether it is a **Draft PR from Agent Jobs** (no auto-merge).
2. Run the CI-equivalent checks locally (see [references/checklist.md](references/checklist.md)).
3. Review by category: scope, security, data/visibility, migrations, tests, docs.
4. Output a structured review: **Blockers**, **Concerns**, **Nits**, **Verdict** (`approve` / `request-changes` / `needs-discussion`).

## UWE-specific focus

| Area | What to verify |
|------|----------------|
| **Studio API** | New/changed routes use `requireStudioApiAuth` or are in the public allowlist (`health`, `spotify/callback`) |
| **Portal leaks** | No `dm_only` / draft / secret content on anonymous paths |
| **AI / RTX** | No campaign context to cloud; rate limits on inference routes |
| **Migrations** | Prisma migration present if schema changed; backward-compatible for SQLite |
| **Monorepo scope** | Domain logic in `packages/`, apps stay thin |
| **Agent PRs** | Draft only; human review required before merge |

## Commands

```bash
pnpm install --frozen-lockfile
pnpm lint && pnpm typecheck && pnpm test && pnpm build:release
pnpm test:security   # if auth, portal, or API routes changed
```

## Output template

```markdown
## Summary
<1–3 sentences>

## Blockers
- ...

## Concerns
- ...

## Nits
- ...

## Verdict
approve | request-changes | needs-discussion
```

Details: [references/checklist.md](references/checklist.md)
