# UWE PR Review Checklist

## CI pipeline (matches `.github/workflows/ci.yml`)

```bash
pnpm install --frozen-lockfile
pnpm lint                    # zero warnings (eslint.config.mjs)
pnpm --filter @uwe/database db:generate
pnpm typecheck
pnpm test
pnpm build:release
```

Add when relevant:

```bash
pnpm test:security           # authz, route guards, public leak scanner
pnpm secret:scan             # new env vars or config files
node --import tsx --test scripts/studio-route-auth.test.ts
```

## Security review triggers

Review with extra care when the PR touches:

- `apps/studio/app/api/**` — Studio API auth
- `apps/portal/**` — player-facing routes, middleware
- `packages/auth/**`, `packages/security/**` — guards, headers, CSRF
- `packages/assets/**` — uploads, MIME validation
- `packages/backup/**` — backup/restore
- `packages/ai-brain/**` — inference, privacy guards
- `.env.example`, `docker-compose.yml` — production defaults

## Studio API allowlist

Only these routes may be **unprotected**:

- `GET /api/health`
- `GET /api/spotify/callback`

Regression: `scripts/studio-route-auth.test.ts`

## Visibility & player safety

- Portal filters `dm_only` server-side (search, graph, export, share)
- Player-safe AI tasks never receive GM secrets
- Share links: password/expiry respected

## Migration PRs

- `packages/database/prisma/schema.prisma` + new folder under `prisma/migrations/`
- Seed changes optional; production uses `RUN_DB_SEED=false`
- See skill `database-migration-review` for deep review

## Agent Job PRs

From `docs/AGENT_JOBS.md`:

- Always **Draft PR**, never auto-merge
- Verify prompt scope matches diff (no unrelated refactors)
- Check for placeholder commits when Cursor CLI unavailable in CI

## Merge decision matrix

| Condition | Action |
|-----------|--------|
| CI fails locally | Request changes |
| New unprotected Studio API route | Block |
| DM-only leak in portal path | Block |
| Missing migration for schema change | Block |
| Missing tests for security-critical path | Request changes |
| Docs-only / typo | Approve if CI green |

## Related docs

- `docs/security-testing.md` — security test suites
- `docs/security/SECURITY_REVIEW.md` — security baseline
