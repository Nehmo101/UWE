# Performance Improvement Plan

> Status: **proposed** · Created 2026-07-07 · Owner: Uwe
>
> Scope: runtime + DB performance of Studio/Portal. Deploy/CD downtime is
> explicitly **out of scope** for this plan. Companion doc:
> [`performance.md`](./performance.md) (budgets + stress seed).

## Context

Evidence gathered from the current code (not the stale project memory):

- DB layer is solid: process-wide Prisma singleton with `WAL`,
  `busy_timeout=5000`, `synchronous=NORMAL` (`packages/database/src/client.ts:44-48`);
  184 `@@index` across 137 models.
- Perf infra already exists: Web-Vitals budgets, bundle budgets,
  `packages/database/src/perf-budgets.ts` with smoke/stress/mega scales.
- No image bloat (0× `next/image`, 4× `<img>`); largest static chunk ~500 KB.

The real levers are the **search/authz read path** and **caching**, both of
which degrade sharply at the `mega` scale (10k pages / 40k content blocks).

Measured gaps at analysis time:
- React `cache()` usage: **0**
- `unstable_cache` usage: **2**
- `export const revalidate`: **0**
- `loadPagesForSearch` loads all pages of a world with all `contentBlocks`
  via `include`, no `take`/`select`; the in-memory index is rebuilt on every
  search call (`search-service.ts:414-489`).
- Authz filtered in JS after load (`searchForAuthContext` `:454-455`;
  `filterPagesForViewer`, 5 call sites) instead of in the SQL `where`.

## Guardrails (do this first, keep green throughout)

Every change is validated against existing budgets — no new harness needed.

```bash
# Baseline before touching anything
UWE_STRESS_SCALE=mega pnpm db:seed:stress
pnpm test            # runs perf-budget.test.ts + stress-scale.test.ts
pnpm ci:light        # lint + typecheck + tests + secret scan + docs
```

Relevant budgets to hold/lower (`perf-budgets.ts` `PERF_BUDGETS_MS`):
`searchQuery: 800`, `searchIndexBuild: 1200`, `listPages: 600`,
`todaySummary: 1500`.

---

## Workstreams (ordered by impact ÷ effort)

### WS1 — Request-level dedup with React `cache()` · effort: S · impact: M–H

Wrap the hot per-request resolvers so a single render resolves each once
instead of per server-component subtree.

- Targets: `getSession` / `getAccessContext` / world-by-slug lookups
  (find exact exports in `@uwe/auth` and the database service layer).
- Wrap each in `import { cache } from "react"`.
- Zero behavior change, zero cache-invalidation risk (scope = one request).

**Done when:** each resolver runs once per request (verify by temporary
query-count log under `mega` seed), all budgets still green.

### WS2 — Trim the search load path · effort: S · impact: H

In `loadPagesForSearch` (`search-service.ts:414`):

- Replace `include` with `select` of only the fields the index actually uses
  (title, slug, type, summary, tags, visibility/publishStatus/secretLevel,
  updatedAt, and the specific content-block fields consumed downstream).
- Add a sane `take` ceiling for the index population where correctness allows.

**Done when:** `searchQuery` and `searchIndexBuild` measurably drop under the
`mega` seed; result sets unchanged (add/extend a search-service unit test).

### WS3 — Push authz into SQL · effort: M · impact: H

Move visibility/publish/secret predicates from JS filters into the Prisma
`where` clause for the read paths that currently over-fetch.

- `searchForAuthContext` (`:454-455`) — build `where` from the auth context.
- `filterPagesForViewer` call sites (Portal dashboard + 4 others) — where the
  slice is small (8 NPCs, 6 handouts…), let the DB filter+limit.
- Keep the JS filter as a defense-in-depth assertion in dev/tests, but it must
  no longer be the primary gate that loads 10k rows into RAM.

**Done when:** dashboard/search paths no longer materialize the full world;
security tests (`pnpm test:security`, `test:authz`, `test:leaks`) stay green —
**this is the correctness-critical workstream, do not skip the authz tests.**

### WS4 — Memoize / index the search · effort: M–L · impact: very-high @scale

Two-stage; ship the cheaper stage first.

1. **Memoize** the per-world index. Key = `worldId + max(updatedAt)` (or
   `unstable_cache` + `revalidateTag('world:<id>')` invalidated on page
   mutation). Rebuild only when content changes, not per request.
2. **FTS5 (target state).** Introduce a SQLite FTS5 virtual table so ranking +
   top-N happen in the DB; JS loads only the matched rows. Larger change —
   scope as a follow-up once WS2/WS3 land and the memoized baseline is known.

**Done when:** repeated searches on an unchanged world skip the rebuild;
`searchIndexBuild` budget can be tightened.

### WS5 — Selective data cache · effort: M · impact: M

Apply `unstable_cache` + tag invalidation **surgically** to rarely-changing,
non-auth-gated data only (page-type metadata, world lists, calendar
aggregation). Do **not** blanket-cache auth-gated dynamic pages.

**Done when:** targeted queries are served from cache and invalidate correctly
on the corresponding mutation (cover with a unit test per cached getter).

---

## Sequencing

```
WS1 ──▶ WS2 ──▶ WS3 ──▶ WS4(memoize) ──▶ WS4(FTS5, follow-up)
                   └────▶ WS5 (parallel, independent)
```

Land WS1–WS3 as separate small PRs (each independently revertable, each gated
by `pnpm ci:light` + the perf tests). WS4/WS5 follow once the trimmed baseline
is measured.

## Out of scope

- Deploy/CD downtime and build-time optimization (explicitly excluded).
- SQLite → Postgres migration (Postgres path already exists; revisit only if
  write contention shows up under load — not part of this plan).
