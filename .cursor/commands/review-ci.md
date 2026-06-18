# Review CI

Audit the UWE CI/CD setup for correctness, redundancy, and local reproducibility.

## Steps

1. Read `.github/workflows/ci.yml`, `pr-check.yml`, `security.yml`, `docs-check.yml`, and `cursor-agent.yml`.
2. Compare workflow steps with root `package.json` scripts (`ci`, `quality`, `lint`, `typecheck`, `test`, `test:ci`, `build:release`, `security:audit`, `docs:check`).
3. Verify `pnpm-lock.yaml` version matches `packageManager` in `package.json`.
4. Check Node version alignment (engines `>=20`, CI uses 22).
5. Identify redundant jobs across workflows (acceptable if documented).
6. Look for missing checks: Prisma generate before typecheck, security tests, secret scan.
7. Verify Docker build job path filters and cache scopes.

## Output format

### Summary
One paragraph on overall CI health.

### Findings (prioritized)
For each finding:
- **Severity**: blocking / warning / info
- **Location**: file or workflow name
- **Issue**: what is wrong or missing
- **Fix**: concrete command, script, or YAML change

### Local verification commands
List exact commands to reproduce each workflow locally.

## Rules

- Do not suggest disabling checks to go green.
- Prefer consolidating via `pnpm quality` / `pnpm ci:check` over duplicating steps in YAML.
- Flag flaky patterns (missing concurrency, no frozen lockfile, implicit Prisma deps).
