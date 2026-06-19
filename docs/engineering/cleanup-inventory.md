# Cleanup inventory

Risk-aware list of technical debt and split candidates. **No automatic deletion** — items here are reviewed before action.

## Large services (split candidates)

| File | ~Lines | Suggested split |
|------|--------|-----------------|
| `packages/database/src/server.ts` | 1080+ | Domain-specific export modules; keep thin barrel |
| `packages/database/src/life-admin-service.ts` | 1000+ | `capture-service`, `hardware-service`, `personal-brain-service` |
| `packages/database/src/label-service.ts` | 870+ | Print pipeline vs template registry |
| `packages/database/src/repository.ts` | 860+ | Asset/session subgraphs |
| `packages/database/src/ai-review-service.ts` | 760+ | Apply strategies per task type |

Marking only — splits should be incremental PRs with unchanged public APIs.

## Barrel files

27 `index.ts` / `server.ts` barrels across packages. Apps should import from `@uwe/database/server`, not `@uwe/database` (Phase-1 in-memory wiki).

| Barrel | Notes |
|--------|-------|
| `packages/database/src/server.ts` | Primary app surface — grows with every feature |
| `packages/database/src/index.ts` | Legacy wiki-engine only |
| `packages/ai-brain/src/index.ts` | Large public API — document subpaths before splitting |

## Legacy / dual-path (not dead)

| Path | Status |
|------|--------|
| `packages/database/src/store.ts`, `seed.ts` | Phase-1 in-memory wiki; wiki-engine tests |
| `schema.prisma` + `schema.postgresql.prisma` | Intentional dual schema |
| `terra-seed.ts` vs `seed.ts` SEED_PAGES | Terra is canonical rich seed |

## Config duplicates (resolved / watch)

| Item | Status |
|------|--------|
| Duplicate `pnpm.overrides` in root `package.json` | **Merged** (single `nodemailer` override) |
| 26 `tsconfig.json` files | Expected monorepo pattern |

## Dead file detection

Run before major cleanup:

```bash
# Orphan source (manual review — not all unused exports are dead)
rg -l "from \"./" packages/database/src | head

# Tests inventory-guard critical security modules
pnpm test:leaks
```

Do not delete files only because they lack importers — CLI scripts and seeds may be entry points.

## Performance / tags (this batch)

| Added | Purpose |
|-------|---------|
| `stress-seed.ts`, `db:seed:stress` | Realistic scale data |
| `tag-service.ts` | Merge, unused, suggestions |
| `perf-smoke.test.ts` | CI performance gate |
| `migration-check.mjs` | Prisma migration folder sanity |

## Related

- `docs/REPO_AUDIT.md`
- `docs/FEATURE_MATURITY_MATRIX.md`
- `docs/engineering/performance.md`
