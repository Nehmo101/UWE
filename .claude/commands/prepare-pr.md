---
description: Summarize the branch diff into a ready-to-paste UWE PR description
---

Produce a ready-to-paste PR description for the current branch.

Follow the canonical procedure and template in **`.cursor/commands/prepare-pr.md`**. Before writing it:

- Review `git diff` vs `main` and the branch commits; identify affected domains
  (Studio, Portal, packages, CI, docs) and any migration / ENV / breaking changes.
- Confirm the pre-push checklist: `pnpm install --frozen-lockfile`, `pnpm quality` (or
  `pnpm quality:quiet`) passes, `pnpm-lock.yaml` committed if deps changed, Prisma
  migration included if the schema changed, docs updated, no secrets in the diff.
- Flag security-sensitive areas (auth, visibility, uploads) for reviewer attention.

Only open a PR if the user explicitly asks. Draft PRs by default; never enable auto-merge
for agent work.
