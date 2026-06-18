# CI — Workflows, Scripts, and Debugging

Stand: 2026-06-18

UWE uses **pnpm** (lockfile: `pnpm-lock.yaml`, `packageManager: pnpm@10.12.1`) and **Turbo** for the monorepo. CI runs on **Node 22** in GitHub Actions.

## Workflows

| Workflow | File | Trigger | Purpose | Blocking |
|----------|------|---------|---------|----------|
| **CI** | `.github/workflows/ci.yml` | Push `main`, all PRs, manual | Full `pnpm quality`, E2E, conditional Docker builds | Yes |
| **PR Check** | `.github/workflows/pr-check.yml` | All PRs | Fast lint, typecheck, test:ci, lockfile check, docs | Yes |
| **Security** | `.github/workflows/security.yml` | Push `main`, PRs, weekly Mon 06:00 UTC | Secret scan, prod audit, security tests | Yes (audit warns on schedule) |
| **Docs Check** | `.github/workflows/docs-check.yml` | PR/push when docs/cursor paths change | Required docs + Markdown sanity | Yes |
| **Cursor Agent** | `.github/workflows/cursor-agent.yml` | `workflow_dispatch` | Agent jobs from Studio admin | Yes (`pnpm quality` before push) |
| **Windows Installer** | `.github/workflows/windows-installer.yml` | Path-filtered | Windows installer build/test | Yes (scoped) |

### CI (`ci.yml`)

1. Install with frozen lockfile
2. `pnpm quality` — full gate:
   - Prisma client generate
   - Lint (zero warnings)
   - Secret scan
   - Typecheck
   - Unit + integration tests
   - Security tests
   - Production dependency audit (high+)
   - Release build
3. **E2E tests** (`pnpm test:e2e`) — Playwright, runs after quality passes
4. Docker build (studio + portal) — only when Docker-related files changed

### PR Check (`pr-check.yml`)

Faster feedback parallel to full CI:

- Lockfile in sync (`git diff --exit-code pnpm-lock.yaml`)
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test:ci`
- `pnpm docs:check`

### Security (`security.yml`)

- `pnpm secret:scan`
- `pnpm security:audit` (alias for `pnpm audit:prod`)
- `pnpm test:security`

Scheduled runs use the same checks for weekly dependency monitoring.

### Docs Check (`docs-check.yml`)

- `pnpm docs:check` — required files, Markdown structure
- Basic internal link scan (warnings only for broken relative links)

## Local commands

| Script | Equivalent CI step |
|--------|-------------------|
| `pnpm ci:check` | PR fast path: lint → typecheck → test:ci → build:release |
| `pnpm quality` | Full CI quality job |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Turbo typecheck |
| `pnpm test` | Unit + integration smoke |
| `pnpm test:ci` | PR test subset (no security tests) |
| `pnpm test:security` | Authz, leaks, route guards |
| `pnpm build:release` | Prisma generate + turbo build |
| `pnpm secret:scan` | Repository secret patterns |
| `pnpm security:audit` | `pnpm audit --prod --audit-level high` |
| `pnpm docs:check` | Required docs + Markdown scan |

### Recommended developer flow

```bash
pnpm install --frozen-lockfile

# During development (faster)
pnpm lint && pnpm typecheck

# Before PR (full gate — same as CI)
pnpm quality
```

**Note:** Use `pnpm ci:check` for the local fast gate (avoids conflict with pnpm's built-in `pnpm ci` install command).

## Debugging common failures

### Lint: unused imports

```
@typescript-eslint/no-unused-vars
```

Remove unused imports or prefix with `_`. Run `pnpm lint` after each edit pass.

### Typecheck: Prisma client missing

```bash
pnpm --filter @uwe/database db:generate
pnpm typecheck
```

### Typecheck: wrong auth import

Import `SESSION_COOKIE_NAME` from `@uwe/auth` or `packages/auth/src/session`, not `runtime-config`.

### Lockfile out of sync

```bash
pnpm install
git add pnpm-lock.yaml
```

CI uses `--frozen-lockfile` — local install must match committed lockfile.

### Secret scan false positive

Remove the hardcoded value or add a justified entry to `ALLOWLIST_PATHS` in `scripts/secret-scan.mjs`.

### Audit failures

```bash
pnpm audit --prod
```

Fix or document accepted risks. Audit level is **high** and above for production deps.

### Docker build failures

Reproduce locally:

```bash
pnpm docker:build:ci
```

## What is blocking?

All workflows above are **blocking** on PRs except:

- Docker build in CI — skipped when no Docker-related files changed
- Docs link scan — broken links emit **warnings**, not failures
- Security audit on scheduled runs — may warn without blocking (full CI still enforces on PRs)

## Related

- `AGENTS.md` — agent quality gate
- `.cursor/skills/ci-quality-gate/SKILL.md` — detailed failure patterns
- `docs/AGENT_JOBS.md` — Cursor agent GitHub Actions integration
