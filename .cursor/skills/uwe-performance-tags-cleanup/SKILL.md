---
name: uwe-performance-tags-cleanup
description: Performance stress seeds, tag taxonomy cleanup, CI smoke budgets, and repo cleanup inventory for UWE. Use when scaling test data, merging tags, adding perf tests, or auditing large services.
---

# UWE Performance, Tags, and Cleanup

## When to use

- Adding performance-sensitive features (search, Today dashboard, graph)
- Tag deduplication, merge, or taxonomy work
- Preparing realistic test worlds
- CI hardening (migration check, perf smoke)
- Documenting split candidates before refactors

## Workflow

### 1. Stress data

```bash
pnpm db:seed:stress         # ~500 pages
UWE_STRESS_SCALE=mega pnpm db:seed:stress   # ~10k pages (additive)
pnpm db:seed:stress:mega    # shortcut
pnpm test                   # includes perf-smoke at PERF_SMOKE_SCALE
```

Constants: `packages/database/src/perf-budgets.ts`, seed: `stress-seed.ts`.

### 2. Tag cleanup

```typescript
import { createTagService } from "@uwe/database/server";

const tags = createTagService(db);
const inventory = await tags.collectInventory({ worldId });
const suggestions = tags.suggestMerges(inventory);
await tags.merge({ worldId, fromTags: ["Stadt"], toTag: "stadt" });
```

Docs: `docs/engineering/tag-taxonomy.md`. Studio UI: `/admin/tags`.

### 3. Performance budgets

Adjust only in `perf-budgets.ts`. If CI fails on slow runners, increase budget with PR justification — do not disable tests.

### 4. Cleanup discipline

- List candidates in `docs/engineering/cleanup-inventory.md`
- No drive-by deletes — use `pnpm test:leaks` for security-critical paths
- Split large services in focused PRs

### 5. Quality gate

```bash
pnpm install --frozen-lockfile
pnpm quality
```

`test:ci` includes `scripts/migration-check.mjs` and package `perf-smoke.test.ts`.

## References

- `docs/engineering/performance.md`
- `docs/engineering/cleanup-inventory.md`
- `docs/FEATURE_MATURITY_MATRIX.md` §11, §13
- `.cursor/skills/ci-quality-gate/SKILL.md`
