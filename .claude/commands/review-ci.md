---
description: Audit the UWE CI/CD setup for correctness and local reproducibility
---

Audit the UWE CI/CD setup for correctness, redundancy, and local reproducibility.

Follow the canonical procedure and output format in **`.cursor/commands/review-ci.md`**. In short:
read `.github/workflows/{ci,pr-check,security,docs-check,cursor-agent}.yml`, compare each step
with the matching root `package.json` script, confirm the pinned `packageManager`
(`pnpm@10.12.1`) and Node 22 alignment, and look for missing guards (Prisma `db:generate`
before typecheck, frozen lockfile, concurrency).

Output prioritized findings (blocking / warning / info) with file, issue, and concrete fix,
plus the exact local commands to reproduce each workflow. Prefer consolidating via
`pnpm quality` / `pnpm ci:check`; never suggest disabling a check to go green.
