# Cursor Workflow — Rules, Commands, and Agent PRs

Stand: 2026-06-19

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

`.cursor/skills/` contains task-specific skills. Full catalog: [.cursor/skills/README.md](../../.cursor/skills/README.md).

| Skill | Domain |
|-------|--------|
| `ci-quality-gate` | Before push / PR — full `pnpm quality` |
| `uwe-orchestrator` | Multi-domain planning, subagent sequencing |
| `daily-admin-os` | Today, Capture, Projects, Workshop, Contracts, Hardware |
| `life-brain-retrieval` | Personal brain embeddings, Maschinenraum-only retrieval |
| `image-studio-workflows` | Image Studio jobs, assets, Capture pipeline |
| `uwe-architecture` | Monorepo layout, package boundaries |
| `uwe-feature-implementation` | End-to-end feature delivery |
| `api-routes` | Studio/Portal REST routes, guards |
| `react-next-ui` | App Router, shared-ui, forms |
| `auth-access` | Sessions, Zugangs-Häkchen, Welt-Zuordnung |
| `ai-agent-proposal-workflow` | AI router, Review/Apply, Maschinenraum routing |
| `local-first-privacy` | Maschinenraum-only, no cloud brain context |
| `uwe-brain` | DnD Brain + Life Brain |
| `dnd-content-consistency-check` | Canon, leaks, generator QA |
| `portal-player-view` | Player wiki, share links |
| `database-migration-review` | Prisma migrations |
| `security-audit` | Structured security review |
| `pr-review` | PR review checklist |
| `deployment-cloudflare-check` | Tunnel + Access + ENV |
| `hardware-homelab` | Host scripts, Maschinenraum, backups |

Technical refactor order: [TECHNICAL_ROADMAP.md](./TECHNICAL_ROADMAP.md). Product rollout order: `product-orchestrator-plan.md` (historisch; Datei entfernt).

Agents should read the relevant skill when starting a specialized task.

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

### Reviewing AI-generated code

- Treat agent output like any other PR — run `pnpm quality` locally if reviewing.
- Check security-sensitive paths: auth, visibility filters, API guards, uploads.
- Verify no secrets in diff (`pnpm secret:scan`).
- Confirm tests exist or manual QA is documented.
- Reject drive-by refactors unrelated to the task.

## PR rules

- **Draft** for agent-generated PRs until human review.
- **No auto-merge** for agent-generated PRs.
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
- `docs/engineering/self-hosted-ci.md` — Self-hosted Runner, Hardware, Billing-Alternativen (für später)
