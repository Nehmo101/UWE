# Review Security

Run a focused security review of UWE changes or the current branch.

## Scope (prioritized)

1. **Auth & sessions** — `packages/auth`, `packages/security`, Studio/Portal middleware
2. **API route guards** — `apps/studio/app/api/**`, `apps/portal/app/api/**`
3. **Player data leaks** — visibility filters in `packages/database/src/permissions.ts`
4. **Secrets** — run `pnpm secret:scan`; check for hardcoded tokens/passwords
5. **Env vars** — `packages/env`, `.env.example`, no secrets in docs
6. **Uploads** — `packages/assets` validation, path traversal
7. **Rate limits** — login, password reset, sensitive endpoints
8. **Dependencies** — `pnpm security:audit`

## Automated checks

```bash
pnpm secret:scan
pnpm test:security
pnpm security:audit
```

## Output format

### Critical (must fix before merge)
- Finding, file/location, exploit or leak scenario, recommended fix

### High (fix or document)
- Same structure

### Info (optional hardening)
- Brief note only if actionable

## Rules

- No theoretical endless lists — max 10 prioritized findings.
- Player leak risks always outrank style issues.
- Reference existing tests in `packages/security-tests/` when suggesting fixes.
- Do not expose real secrets in the review output.

For full audits, use `.cursor/skills/security-audit/SKILL.md`.
