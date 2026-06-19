# Performance budgets and stress testing

UWE uses a synthetic **perf-test** world and CI smoke tests to catch regressions before they reach production self-hosts.

## Stress seed

| Command | Scale | Purpose |
|---------|-------|---------|
| `pnpm db:seed:stress` | ~500 pages, 2k links, 200 assets | Local profiling, manual QA |
| `UWE_STRESS_SCALE=mega pnpm db:seed:stress` | ~10k pages | Heavy local profiling |
| CI `perf-smoke.test.ts` | ~60 pages (see `PERF_SMOKE_SCALE`) | Fast gate on every test run |

The stress world is idempotent via `runSeedOnce(prisma, "stress-world", 1, …)` — re-running does not duplicate data.

```bash
pnpm db:seed:stress
```

World slug: `perf-test`. Includes intentional tag variants (`Stadt` / `stadt` / `STADT`) for tag-cleanup testing.

## Budgets (milliseconds)

Defined in `packages/database/src/perf-budgets.ts`:

| Operation | Budget | Test |
|-----------|--------|------|
| Page list by world | 600 ms | `perf-smoke.test.ts` |
| Search index build | 1200 ms | `perf-smoke.test.ts` |
| DM search query | 800 ms | `perf-smoke.test.ts` |
| Today summary aggregation | 1500 ms | `perf-smoke.test.ts` |
| Tag inventory scan | 1000 ms | `perf-smoke.test.ts` |
| Personal brain search | 500 ms | `perf-smoke.test.ts` |

Budgets are wall-clock on CI runners with SQLite. If CI hardware changes, adjust budgets in one place (`perf-budgets.ts`) and document the reason in the PR.

## What is not covered yet

- Real browser LCP measurement in CI (bundle chunk budgets cover client JS size)
- PostgreSQL-specific load tests (`pnpm test:postgres-smoke` covers schema only)

## Bundle budgets (CI)

After `pnpm build:release`, `scripts/bundle-budget-check.mjs` validates Studio static chunk sizes:

| Check | Budget |
|-------|--------|
| Total static chunks | 6500 KB |
| Largest single chunk | 550 KB |
| Shared framework chunks | 120 KB each |

## What was previously listed as gaps (now partially covered)

- ~~LCP / bundle-size budgets in CI~~ — bundle chunk gate in `quality`
- `@next/bundle-analyzer` — optional local profiling only

## Related

- Tag cleanup: `docs/engineering/tag-taxonomy.md`
- Cleanup inventory: `docs/engineering/cleanup-inventory.md`
- Feature maturity: `docs/FEATURE_MATURITY_MATRIX.md` §11
