# Migration from GitHub Copilot to Cursor

Stand: 2026-06-18

## Inventory (2026-06-18)

### Copilot-specific files found

**None.** The repository had no `.github/copilot-instructions.md`, `.copilot/` directory, or other Copilot-named configuration at migration time.

### Pre-existing AI / agent infrastructure

| Asset | Status | Notes |
|-------|--------|-------|
| `AGENTS.md` | **Retained** | Quality gate for cloud agents; complements Cursor Rules |
| `.cursor/skills/` | **Retained** | Task-specific skills (CI, security, features, etc.) |
| `.github/workflows/cursor-agent.yml` | **Retained** | GitHub Actions dispatch for Studio agent jobs |
| `docs/AGENT_JOBS.md` | **Retained** | Agent job architecture |
| `docs/ai-brain-mail/CURSOR_*.md` | **Retained** | Historical Cursor prompts for AI-brain work |

## What was migrated to Cursor

Content from `AGENTS.md` and project docs was distilled into Cursor Rules:

| Cursor Rule | Source / purpose |
|-------------|------------------|
| `.cursor/rules/uwe-project.mdc` | `docs/ARCHITECTURE.md`, README, domain overview |
| `.cursor/rules/coding-standards.mdc` | ESLint conventions, auth imports, React patterns |
| `.cursor/rules/ci-and-testing.mdc` | `AGENTS.md` quality gate, CI scripts |
| `.cursor/rules/security.mdc` | `docs/auth-api-security.md`, security test practices |
| `.cursor/rules/docs.mdc` | Documentation placement conventions |

New Cursor Commands:

- `.cursor/commands/review-ci.md`
- `.cursor/commands/fix-failing-ci.md`
- `.cursor/commands/review-security.md`
- `.cursor/commands/prepare-pr.md`

## What was added (not Copilot replacement)

| Addition | Purpose |
|----------|---------|
| `.github/workflows/pr-check.yml` | Fast PR feedback |
| `.github/workflows/security.yml` | Dedicated security + weekly audit |
| `.github/workflows/docs-check.yml` | Docs validation on doc changes |
| `scripts/docs-check.mjs` | Required docs + Markdown sanity |
| `docs/engineering/ci.md` | CI reference |
| `docs/engineering/cursor-workflow.md` | Cursor workflow reference |
| `package.json` scripts: `ci:check`, `test:ci`, `security:audit`, `docs:check` | Local/CI parity |

## What was removed or deprecated

- **Nothing removed** — no Copilot files existed.
- `ci.yml` was refactored to call `pnpm quality` (behavior unchanged, less YAML duplication).

## What stays GitHub Actions standard (not Cursor-specific)

These are general CI/CD concerns, not tied to Cursor:

- `ci.yml` — full quality gate + release build
- `security.yml` — secret scan, audit, security tests
- `docs-check.yml` — documentation validation
- `deploy.yml` — deploy via self-hosted runner on the Linux host
- `pnpm quality` — canonical local/CI gate

Cursor integration is limited to:

- Rules and commands for agent context
- `cursor-agent.yml` for dispatched agent jobs
- `AGENTS.md` as the short agent entry point

## If Copilot instructions are added later

Do not maintain parallel Copilot and Cursor instruction files. Instead:

1. Add content to the appropriate `.cursor/rules/*.mdc` file.
2. Update `AGENTS.md` if it affects the quality gate.
3. Document in this file what was merged and deprecate the Copilot file with a pointer to Cursor Rules.

## Related

- `docs/engineering/cursor-workflow.md`
- `docs/engineering/ci.md`
- `AGENTS.md`
