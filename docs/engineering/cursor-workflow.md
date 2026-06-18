# Cursor Workflow — Rules, Commands, and Agent PRs

Stand: 2026-06-18

UWE is optimized for **Cursor Agents**, **Cloud Agents**, and local development with shared quality gates. Copilot-specific instructions are not used; project context lives in Cursor Rules and `AGENTS.md`.

## Cursor Rules (`.cursor/rules/`)

| Rule | File | Scope |
|------|------|-------|
| Project context | `uwe-project.mdc` | Always — architecture, domains, defaults |
| Coding standards | `coding-standards.mdc` | `*.{ts,tsx,js,mjs}` |
| CI and testing | `ci-and-testing.mdc` | Always — quality gate, test expectations |
| Security | `security.mdc` | Always — auth, leaks, secrets |
| Documentation | `docs.mdc` | `*.{md,mdc}` |

Rules are loaded automatically by Cursor. `alwaysApply: true` rules apply to every agent session; glob-scoped rules apply when editing matching files.

### Skills (deeper workflows)

`.cursor/skills/` contains task-specific skills (CI gate, security audit, feature implementation, DB migration review, etc.). Agents should read the relevant skill when starting a specialized task.

## Cursor Commands (`.cursor/commands/`)

Invoke from Cursor chat with `/` or via the command palette:

| Command | Purpose |
|---------|---------|
| `review-ci` | Audit workflows, scripts, lockfile alignment |
| `fix-failing-ci` | Diagnose CI logs, reproduce locally, minimal fix |
| `review-security` | Prioritized auth/leak/secret/dependency review |
| `prepare-pr` | PR description template and pre-push checklist |

## Working with Cursor Agent

### Standard flow

1. Create a feature branch (`cursor/<name>-<id>` for cloud agents).
2. Implement with scoped changes — match package boundaries.
3. Run quality gate locally:
   ```bash
   pnpm install --frozen-lockfile
   pnpm quality
   ```
4. Use `/prepare-pr` to draft the PR description.
5. Open a **draft PR** — no auto-merge for agent work.

### Cloud / GitHub Agent Jobs

Studio admin can dispatch jobs via `.github/workflows/cursor-agent.yml`. See `docs/AGENT_JOBS.md`.

The workflow runs `pnpm quality` before pushing. Failed quality blocks the PR.

### Reviewing AI-generated code

- Treat agent output like any other PR — run `pnpm quality` locally if reviewing.
- Check security-sensitive paths: auth, visibility filters, API guards, uploads.
- Verify no secrets in diff (`pnpm secret:scan`).
- Confirm tests exist or manual QA is documented.
- Reject drive-by refactors unrelated to the task.

## PR rules

- **Draft** for agent-generated PRs until human review.
- **No auto-merge** for agent jobs (`AGENT_JOBS_AUTO_MERGE` must stay `false`).
- Full `pnpm quality` must pass in CI before merge.
- Document ENV, migration, and deployment impacts in the PR body.

## Local vs CI parity

| Local | CI |
|-------|-----|
| `pnpm quality` | `ci.yml` quality job |
| `pnpm ci:check` | `pr-check.yml` fast path (subset) |
| `pnpm docs:check` | `pr-check.yml` + `docs-check.yml` |

Prefer `pnpm quality` before push — it matches the blocking CI gate exactly.

## Related

- `AGENTS.md` — concise agent instructions
- `docs/engineering/ci.md` — workflow details
- `docs/engineering/migration-from-copilot.md` — Copilot → Cursor migration notes
- `docs/AGENT_JOBS.md` — GitHub Actions agent integration
