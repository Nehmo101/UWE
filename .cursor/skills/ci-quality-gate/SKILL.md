---
name: ci-quality-gate
description: Run the UWE CI quality pipeline before finishing agent work. Use when implementing features, fixing bugs, or preparing a PR. Prevents recurring lint (unused imports) and typecheck failures.
---

# CI Quality Gate

## When to use

Before committing/pushing agent work, after rebase, or when CI fails on your PR.

## Workflow

1. `pnpm install --frozen-lockfile`
2. **`pnpm file-size:check`** — fail in seconds if a file exceeds the 700-line budget (see Pattern E)
3. Run gate — pick one:
   - **`pnpm quality:quiet`** — recommended for agents (summary + tail on failure)
   - **`pnpm quality`** — full verbose output
   - **`pnpm ci:light`** — faster PR mirror

Full step list and common failures: **[AGENTS.md](../../../AGENTS.md)**.

## Do not

- Push with only partial checks
- Skip `pnpm-lock.yaml` after dependency changes
- Import server-only modules into client components
- Grow production files past **700 lines** — split into modules first (`pnpm file-size:check`)

## References

- [failure-patterns.md](references/failure-patterns.md) — CI log examples
- [docs/engineering/ci.md](../../../docs/engineering/ci.md) — workflows
