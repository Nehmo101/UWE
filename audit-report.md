# UWE — Full Codebase Audit & Prioritized Remediation Report

**Codebase:** UWE (Universeller Welten-Editor) — self-hosted campaign-brain / world-wiki / daily-admin OS
**Stack:** pnpm 10 + Turborepo monorepo · TypeScript (strict) · Next.js 15 (App Router) · Prisma 7 + SQLite (libsql) · Node 22 · Playwright + node:test
**Scale:** ~2,900 tracked files · ~2,180 TS/TSX · 33 packages · 2 Next.js apps (studio, portal) + Tauri connector client
**Audit date:** 2026-07-10 · **Branch:** `claude/new-session-1vt2cs`
**Method:** 6 parallel audit agents (security, performance, code quality, test coverage, dependencies, architecture), each finding adversarially re-verified against the current source. Findings below were confirmed directly in this session; unverifiable or already-mitigated candidates were dropped.

---

## Remediation Status (PR #764)

**All 35 findings fixed and verified** (full `pnpm ci:light` green: lint, typecheck, all package tests, migration-check, file-size budget, server-barrel-freeze, secret-scan, docs-check). `pnpm audit --prod` now reports **no known vulnerabilities**, and Turborepo no longer detects any circular package dependency.

Fixed — security & correctness: **C1** (restore execute owner-gated + regression tests) · **M1** (restore preview owner-gated) · **M8** (asset secret-filter alignment) · **M13** (viewer visibility pushed into SQL with the JS filter kept authoritative, proven equivalent).
Fixed — performance: **H1** (search index memoized behind a page+block freshness key) · **H2** (wiki page views reuse a cached link graph instead of loading the whole world) · **H3** (renderBlock N+1) · **H4** (/today double-compute) · **M2** (auth hot path uses the shared Prisma singleton) · **M12** (async file serving + cache headers) · **M14** (share-link N+1) · **L7** (admin search parallelized) · **L8** (ActivityLog index + migration).
Fixed — architecture: **H5** (`@uwe/database ↔ @uwe/mail` cycle broken via a new `@uwe/mail-core` leaf + removing the `mail-portal-service` back-edge — turbo is now cycle-free) · **M6** (login/2FA-challenge orchestration extracted into `@uwe/auth`, session-IP recording unified) · **M15** (three near-cap monoliths split — `settings-service.ts`, `graph-engine.ts`, `label-actions.ts` — baseline ratcheted down) · **M4** (opt-in log retention) · **M5** (job recovery on boot) · **M11** (dnd-api domain extraction) · **L4** (2FA route-helper dedup → `@uwe/auth` factory) · **L6** (`@uwe/security → @uwe/ai-brain` layering inversion removed).
Fixed — tests & hygiene: **M3** (AST-based Server-Action guard enforcement) · **M7** (portal route auth inventory) · **M9** (deleteUser lockout tests) · **M10** (backup schedule tests) · **H6** (backup-encryption tests) · **L12** (2FA negative + TOTP RFC vectors) · **L13** (connector test de-flake) · **L3** (CI sync guard for duplicated UI primitives) · **L1** (9 orphaned modules + dead co-DM flow) · **L2** (5 unused deps) · **L5** (dead shared-ui exports) · **L9/L10** (hono + postcss overrides) · **L11** (@next/env).

All findings from every severity tier are now resolved on this branch. The work landed in five verified waves (each gated by `pnpm ci:light`): the CRITICAL restore-authz fix, then quick-wins + tests, then scaling-perf + architecture, then the login/mail/monolith refactors. The two largest architectural changes — H5 (breaking the mail cycle, ~74 files) and M15 (monolith splits) — were done as pure, behavior-preserving moves with re-exports, whole-repo typecheck, and baseline ratcheting.

One nuance surfaced during M3: two allowlisted admin/owner Server Actions (`activateAiGeneralPromptAction`, `updateDeploymentConfigAction`) gate on `requireAdminAccess`/`requireOwner`, which enforce auth+role but not the extra Origin check `requireStudioActionAuth` layers on top of Next.js' built-in Server-Action CSRF — low risk, but a candidate for hardening.

---

## Executive Summary

**Overall health: STRONG (7.5 / 10) — one CRITICAL authorization gap, otherwise a disciplined, well-defended codebase.**

UWE is unusually well-engineered for a self-hosted hobby project: Studio API routes are uniformly guarded (enforced by a static route-inventory test), CSRF is applied to mutating routes, all raw SQL uses constant strings, wiki/mail HTML is DOMPurify-sanitized, no secrets are tracked, the `dm_only`/secret-visibility invariant is enforced at the data layer with regression tests, and framework/dependency hygiene is current (Next 15.5.19, React 19.2.7, Prisma 7.8.0, TS 5.9.3) with a clean license profile and only 2 low-impact transitive advisories. Test coverage is broad (449 test files, all green with zero skips) and the anti-monolith budget system is real and enforced.

The health score is held back by **one CRITICAL finding**: the destructive full-database restore endpoint is not owner-gated in the way SECURITY.md claims — a lower-privileged `dm` Studio user can trigger a full DB overwrite (and, via the restore bundle, inject an owner account). Beyond that, the debt is concentrated in **two systemic performance/architecture patterns** — an unmemoized per-request search/wiki index that hydrates the whole world DB on hot paths, and ~160 call sites that create throwaway per-request PrismaClients against the single SQLite file, contradicting the codebase's own documented singleton — plus a confirmed `@uwe/database ↔ @uwe/mail` circular dependency and a handful of high-value test gaps (backup encryption has zero tests; ~280 Server Actions have no guard-enforcement test).

**Finding count:** 1 CRITICAL · 6 HIGH · 15 MEDIUM · 8 LOW (30 total, all HIGH-confidence).

---

## Prioritized Findings

### 🔴 CRITICAL

---

#### C1 · Full-database restore is not owner-gated — any Studio `dm` user can overwrite the entire DB
- **Category:** Security (authorization / RBAC)
- **Location:** `apps/studio/app/api/backup/restore/execute/route.ts:9` · guard `packages/security/src/security/guards.ts:152-168`
- **Confidence:** HIGH
- **Description:** `POST /api/backup/restore/execute` performs a destructive full-database restore but never checks the caller's role. Its only guard, `requireRestoreOwnerAuth`, calls `requireStudioApiAuth` (which admits `owner`, `admin`, **and `dm`** per `STUDIO_ACCESS_ROLES`) and then: `const restoreToken = process.env.RESTORE_OWNER_TOKEN?.trim(); if (!restoreToken) return null;` — i.e. it **allows the request when `RESTORE_OWNER_TOKEN` is unset**, which is the shipped default (`.env.example:49` has it commented out). Even when the token is set, `isSameOriginBrowserRequest()` bypasses it for any logged-in Studio browser session. The intended control `canRestoreBackup` (owner-only, `packages/backup/src/permissions.ts:25`) is imported **only** for the UI-facing `getBackupPermissions` (`backup-handlers.ts:47`) and is never enforced on the mutating path. Because restore recreates `User` rows from the uploaded bundle, a `dm` can also inject an owner account — a privilege-escalation path, not just data loss. This directly contradicts SECURITY.md's stated "OWNER-only restore" invariant.
- **Evidence:** Route guard is `requireRestoreOwnerAuth(request)`; guard body returns `null` (allow) when `RESTORE_OWNER_TOKEN` is unset; `grep canRestoreBackup` shows it is only ever called in `backup-handlers.ts:47` (UI permissions), never in `postRestoreExecute`.
- **Recommended fix:** In the execute handler, resolve the session auth context (`resolveStudioApiAuthContext`) and enforce owner via `requireOwnerApiAuth` (already defined at `guards.ts:173`) **or** an explicit `canRestoreBackup(context.user.role)` check — in addition to, not instead of, `requireRestoreOwnerAuth`. Do the same in the preview route (see M1). Do not rely on `RESTORE_OWNER_TOKEN` being set or on the client hiding the button.
- **Effort:** 30 min · **Quick win:** ✅

---

### 🟠 HIGH

---

#### H1 · Global command-palette search rebuilds a full in-memory index of ALL pages + content blocks on every request
- **Category:** Performance
- **Location:** `packages/database/src/search-service.ts:429` (index build) · caller `apps/studio/app/api/command/search/route.ts:23`
- **Confidence:** HIGH
- **Description:** Every `/api/command/search` call (fired per keystroke from the command palette) runs `searchStudioCrossDomain → searchGlobalForDm → loadPagesForSearch` with no `worldSlug`, loading **every** page in the DB plus **all** content blocks, merging entity tags, building a fresh in-memory search index, scoring in JS, and discarding it. There is zero memoization — the index is rebuilt per request. Perf budgets (`searchIndexBuild` 1200 ms) are only validated at ~60-page CI scale; at the documented `mega` scale (10k pages / 40k blocks) every keystroke materializes the whole world DB in RAM. The gap is documented in `docs/engineering/performance-improvement-plan.md` (WS4, status "proposed", unimplemented).
- **Recommended fix:** Memoize the per-world/global index keyed on `worldId + max(page.updatedAt)` (or `unstable_cache` with a mutation-invalidated tag); longer term move ranking into SQLite FTS5 so only matched rows are hydrated.
- **Effort:** 1–2 days · **Quick win:** ❌

#### H2 · Every wiki page view loads the ENTIRE world (all pages + all blocks) to compute backlinks and the neighbor graph
- **Category:** Performance
- **Location:** `packages/database/src/page-viewer-service.ts:139` · studio dup at `page-service.ts:424` + `graph-service.ts:310`
- **Confidence:** HIGH
- **Description:** `buildPageViewForViewer` (portal + studio player-preview wiki route) calls `repo.listPagesWithBlocksForGraphUnfiltered(worldSlug, {})` — an unbounded `findMany` with `include:{contentBlocks, campaign}` over every page — then regex-parses the combined content of every visible page to find backlinks to one page, per request. The studio DM route does the equivalent **twice** per view (backlink loop over all `visibleNodes` + `buildPageGraph → buildWorldGraph` reloading the full world with blocks). At stress scale (500–10k pages) this is O(world content) hydration + O(pages × links) regex work on the hottest content route.
- **Recommended fix:** Compute backlinks from the persisted `PageLink` table instead of re-parsing all content per view; restrict the neighbor graph to the focus page's 1-hop neighbors; cache the parsed link graph per world keyed on `max(updatedAt)`.
- **Effort:** 1–2 days · **Quick win:** ❌

#### H3 · N+1: `renderBlockContentForViewer` re-loads all pages of the world once per content block on portal page views
- **Category:** Performance
- **Location:** `packages/database/src/auth.ts:886` · callers `apps/portal/app/auth/worlds/[worldSlug]/[slug]/page.tsx:67` and `page-viewer-service.ts:127`
- **Confidence:** HIGH
- **Description:** `AuthService.renderBlockContentForViewer` runs `db.page.findMany` for ALL pages of the world (to build a wikilink lookup map) plus a `world.findUnique` on **every call**. Both callers invoke it inside `contentBlocks.map(...)` per block, so a 20-block portal wiki page issues 20 full-world page queries and rebuilds the same lookup Map 20×, serialized on the single SQLite connection.
- **Recommended fix:** Build the page-lookup index once per request (e.g. `renderBlocksForViewer(worldSlug, blocks[], ctx)` or accept a preloaded lookup), then render all blocks against it. Behavior-identical; removes N−1 full-table queries per page view.
- **Effort:** 2–3 h · **Quick win:** ❌

#### H4 · `/today` dashboard computes admin status, homelab status, leak scan, AI/RTX probes and life-admin summary TWICE per request
- **Category:** Performance
- **Location:** `apps/studio/src/lib/today-dashboard.ts:141-144` · `apps/studio/src/lib/homelab-dashboard.ts:72,120`
- **Confidence:** HIGH
- **Description:** `getTodayDashboardData` awaits `getAdminDashboardStatus(db)` **and** `getHomelabCockpitData(db)` in the same `Promise.all` — but `getHomelabCockpitData` internally re-calls `getAdminDashboardStatus` (`homelab-dashboard.ts:72`) and `lifeAdmin.getTodaySummary()` (`:120`), both already computed directly. `getAdminDashboardStatus` includes `scanPublicContentLeaks` (loads all published pages + blocks + assets + soundboard rows for every world, sequentially) plus live `getInferenceStatus`/`checkRtxReadiness` network probes. So one `/today` render performs 2× full-content leak scans, 2× inference/RTX HTTP probes, and 2× ~15-query life-admin summaries. `/today` is CI-budgeted (LCP 3000 ms, `todaySummary` 1500 ms) — doubled here. **Confirmed:** `homelab-dashboard.ts` lines 72 and 120 re-invoke both.
- **Recommended fix:** Pass the already-computed `adminStatus` and `lifeSummary` into `getHomelabCockpitData` as parameters (or wrap both in React `cache()` for per-request dedup). Separately, cache `scanPublicContentLeaks` for a few minutes instead of scanning all published content per render.
- **Effort:** 30 min · **Quick win:** ✅

#### H5 · Circular package dependency: `@uwe/database` ↔ `@uwe/mail` (confirmed by Turborepo)
- **Category:** Architecture
- **Location:** `packages/mail/package.json:23` ↔ `packages/database/package.json:83`
- **Confidence:** HIGH
- **Description:** The mail domain is split across two packages that import each other at runtime in both directions. `packages/database` holds 8+ mail-domain services (`mail-account-service`, `mail-compose-service`, `mail-unsubscribe-service`, …) importing runtime functions from `@uwe/mail`, while `@uwe/mail` services import back from `@uwe/database` (`resolveTokenEncryptionSecret` via `@uwe/database/token-crypto`, `mail-account-service`, `mail-unsubscribe-service`). Both `package.json` files declare each other as deps. This is exactly the failure mode CLAUDE.md's "Neue Domänen-Services gehören NICHT in `packages/database`" rule exists to prevent. **Confirmed:** both `package.json` cross-dependencies present.
- **Recommended fix:** Consolidate the mail domain in `@uwe/mail` — move the DB-bound `mail-*` services out of `packages/database` (they already take `PrismaClient` as a param, so it's mechanical), keep only the generic token-crypto primitive in database (or move to `@uwe/auth`/`@uwe/security`), and drop `@uwe/mail` from `packages/database` deps. Temporary `@uwe/database` subpath re-exports preserve back-compat.
- **Effort:** 1–2 days · **Quick win:** ❌

#### H6 · Backup encryption/decryption module has ZERO test coverage
- **Category:** Test coverage
- **Location:** `packages/backup/src/encrypt.ts:45` (sole consumer: `export.ts:87,122`)
- **Confidence:** HIGH
- **Description:** The AES-256-GCM backup encryption module (`encryptBackupPayload`, `decryptBackupPayload`, `isEncryptedBackupPayload`, `resolveBackupEncryptionKey` with dual env-key/scrypt-password derivation) has no test anywhere in the repo. `backup.test.ts` (431 lines) exercises only **unencrypted** export/restore. A regression in the encrypt/decrypt round-trip, key-derivation precedence (hex env key vs sha256-of-string vs scrypt password), or payload format would make encrypted backups silently **unrestorable** — discovered only at disaster-recovery time, the worst moment for the project's primary data-loss safety net. **Confirmed:** `grep encryptBackupPayload --include=*.test.ts` → 0 hits.
- **Recommended fix:** Add `packages/backup/src/encrypt.test.ts` with round-trip tests for both key forms (64-hex + passphrase), the scrypt path, wrong-password → error, tampered `authTag`/`iv` → error, `isEncryptedBackupPayload` true/false, and env-key-over-password precedence. Optionally one encrypted export→restore case in `backup.test.ts`.
- **Effort:** 30 min · **Quick win:** ✅

---

> **Note — the "~160 per-request `createPrismaClient()`" pattern** was surfaced by both the performance and architecture auditors (`packages/database/src/client.ts:93` vs the documented singleton at `:74`; hottest site `apps/studio/src/lib/auth-session.ts:22` on every authenticated request). It carries a HIGH severity from both. It is consolidated as **M2** below to avoid double-counting; treat it with HIGH-tier priority.

---

### 🟡 MEDIUM

#### M1 · Restore **preview** accessible to non-owner Studio users (`dm`/`admin`) despite owner-only policy
- **Category:** Security · **Location:** `apps/studio/app/api/backup/restore/preview/route.ts:6` · `backup-handlers.ts:196`
- **Confidence:** HIGH · **Effort:** 30 min · **Quick win:** ✅
- Guarded only by `guardStudioApiMutation` (admits `owner`/`admin`/`dm`) + CSRF. `postRestorePreview` runs `previewRestoreOnly` on any uploaded bundle with no role check, despite `canPreviewRestore` being owner-only. Lets a `dm`/`admin` enumerate any backup's full contents summary (worlds, campaigns, **user list**, memberships) — data outside their scope. Same client-side-only enforcement bug as C1. **Fix:** enforce `canPreviewRestore` server-side using the resolved session role; align `/api/backup` create/download guards with `canCreateBackup`/`canDownloadBackup` so `admin` isn't implicitly granted excluded backup capabilities.

#### M2 · ~160 per-request `createPrismaClient()` call sites contradict the documented shared-singleton pattern (incl. the auth hot path)
- **Category:** Architecture / Performance · **Location:** `apps/studio/src/lib/auth-session.ts:22` · `packages/database/src/client.ts:74` vs `:93`
- **Confidence:** HIGH · **Effort:** 1–2 days · **Quick win:** ❌
- `client.ts:74` documents `getSharedPrismaClient()` as "Process-wide SQLite singleton — avoids lock storms from per-request clients," yet 99 files in studio + 61 in portal call `createPrismaClient()` per request, opening a fresh libsql connection to the same SQLite file each time. Worst case: `getUserFromRequestCookieHeader()` creates+tears down a client on **every** cookie-authenticated Studio API request. `applySqlitePragmas()` sets `busy_timeout=5000` **fire-and-forget**, so short-lived connections can run queries before the timeout is applied and fail with `SQLITE_BUSY` under concurrent write load — the exact "lock storm" the comment warns about. `apps/portal/src/lib/auth.ts` already uses the singleton correctly, so the codebase is split. **Fix:** switch auth hot paths to `getSharedPrismaClient()` immediately, migrate the rest mechanically, add an ESLint rule against arg-less `createPrismaClient()` in `apps/**`.

#### M3 · No test enforces that every Server Action calls its auth guard (only the `"use server"` directive is checked)
- **Category:** Test coverage · **Location:** `apps/studio/src/lib/server-actions.test.ts:28`
- **Confidence:** HIGH · **Effort:** 2 h · **Quick win:** ❌
- ~280 exported Studio actions + 6 portal action modules; every one currently calls `requireStudioActionAuth()`/`requirePortalActionAuth()`, and the guard helper documents "middleware alone is not sufficient." Yet the only test asserts nothing but `firstLine === '"use server";'`. The equivalent API-route surface has a full static auth-inventory test (`scripts/studio-route-auth.test.ts`); the strictly-more-exposed action surface has no such net, so one forgotten guard in a new action file ships silently. **Fix:** extend the test (and add a portal twin) to statically assert each exported action awaits its guard as the first statement, with an explicit allowlist for intentionally-public actions.

#### M4 · No retention/pruning for any log, audit, version, or delivery table — unbounded SQLite growth
- **Category:** Architecture (scaling) · **Location:** `packages/database/prisma/schema.prisma` (AuditLog:1578, ActivityLog:1465, JobLog:1869, MailMessageLog:2079, PageVersion:3292, …)
- **Confidence:** HIGH · **Effort:** 1 day · **Quick win:** ❌
- ≥12 append-only tables; repo-wide search finds **no** time-filtered `deleteMany` outside backups (`retention.ts`) and calendar events. UWE is always-on, audits every login/rate-limit hit, logs every job line, versions every page save — on one SQLite file that is also zipped into every backup. Over months the DB and backup sizes grow without bound and hot-table scans degrade. **Confirmed:** `grep "createdAt: { lt"` → 0 matches outside generated code. **Fix:** add a retention sweep to the existing maintenance/job path with per-table max-age/max-rows settings via the established settings-service + systemd-timer self-service pattern.

#### M5 · In-process fire-and-forget job execution has no recovery after process restart
- **Category:** Architecture · **Location:** `apps/studio/src/lib/job-executor.ts:10-22` · `instrumentation.ts` (no sweep)
- **Confidence:** HIGH · **Effort:** 2–4 h · **Quick win:** ❌
- Jobs are DB-persisted but executed via `dispatchJob()`'s fire-and-forget promise inside the Next process, deduped by an in-memory `Set`. No startup sweeper, no poller. The app itself makes restarts routine (`/api/admin/host-restart`, `/api/admin/host-update`, systemd deploys). On restart mid-job, `running` jobs stay `running` forever and `pending` jobs are never re-dispatched; `retry()` rejects both states, so the only escape is manual per-job cancel. **Fix:** in `instrumentation.ts register()`, add a boot sweep that fails stuck `running` jobs ("process restarted") and re-dispatches `pending` ones; optionally a periodic pending-job poll.

#### M6 · Login/2FA orchestration hand-rolled in 5 route handlers with observable behavioral drift
- **Category:** Architecture / Security · **Location:** `apps/portal/app/api/auth/login/route.ts:160` vs `apps/studio/.../login/route.ts:164`, `.../enter/route.ts:104`
- **Confidence:** HIGH · **Effort:** 1 day · **Quick win:** ❌
- The security-critical login state machine (rate-limit → Turnstile → authenticate → 2FA challenge → `createSession` + cookie → audit) is duplicated across 5 handlers. Already drifted: Portal records session IP (`createSession(user.id, { ipAddress: ip })`) while Studio login/enter/2FA-verify call `createSession(user.id)` without it; Portal uses an inline `{ maxAttempts: 8, windowMs: 5*60_000 }` instead of `RATE_LIMIT_PRESETS.login`. Business logic in route handlers (golden-rule violation); any future hardening must touch 5 places. **Fix:** extract `performLoginFlow()`/`completeTwoFactorLogin()` into `@uwe/auth`, parameterized by surface + access predicate; unify the `createSession` signature so session IP is always recorded.

#### M7 · No per-route auth inventory test for the 25 Portal API routes (Studio has one, Portal does not)
- **Category:** Test coverage · **Location:** `packages/security-tests/src/route-authz.test.ts:252` · `find apps/portal/app/api -name route.ts` → 25
- **Confidence:** HIGH · **Effort:** 1–2 h · **Quick win:** ❌
- Every Studio route is enumerated and asserted protected-or-allowlisted; the Portal — whose entire purpose is showing only filtered content — has only two spot checks (graph viewer-context regex + a middleware regex). A new/modified Portal route (admin/audit-log, session touch, asset-file signature) skipping the guard pattern wouldn't be caught statically. **Fix:** generalize `studio-route-inventory.ts` into a shared helper, define `PORTAL_PUBLIC_API_ALLOWLIST` + a portal guard pattern, assert every portal `route.ts` is guarded or allowlisted.

#### M8 · `filterAssetsForContext` ignores `secretLevel`/`revealState`, diverging from `isAssetAccessible` — and is untested
- **Category:** Security / Test coverage · **Location:** `packages/database/src/permissions.ts:175` (dup in `packages/assets/src/permissions.ts:28`)
- **Confidence:** HIGH · **Effort:** 45 min · **Quick win:** ✅
- `filterAssetsForContext` filters non-DM contexts by **visibility only**, while sibling `isAssetAccessible` additionally rejects unrevealed secrets (`isPlayerExposableContent` with `secretLevel`/`revealState`). A `player_visible` asset marked `dm_secret`+`hidden` passes the list filter but fails the single-asset check. **Currently latent** — no app code calls `listAssetsForContext` today (portal serving goes through the tested `getAssetForViewer`) — but both functions are exported through the frozen `@uwe/database/server` barrel, so a future portal/share caller would leak hidden-secret asset metadata in listings. No test calls it. **Fix:** align `filterAssetsForContext` with `isAssetAccessible`; add `dm_secret`+`hidden` tests for both list and single-asset paths in `visibility-security.test.ts`.

#### M9 · Owner-lockout guards in `deleteUser` (`CANNOT_DELETE_SELF`, `LAST_OWNER`) are untested
- **Category:** Test coverage · **Location:** `packages/database/src/user-service.ts:308,316`
- **Confidence:** HIGH · **Effort:** 20 min · **Quick win:** ✅
- These guards prevent bricking the single-admin self-hosted instance, but no test exercises either branch (only the non-owner happy path at `user-management.test.ts:184`). `deleteUser` is reachable from the admin UI/API **and** the NL command center ("delete user X"), so a regression lets an owner lock themselves out with one confirmed command. **Confirmed:** `grep CANNOT_DELETE_SELF|LAST_OWNER --include=*.test.ts` → 0 hits. **Fix:** add two tests — self-delete rejects `CANNOT_DELETE_SELF`, deleting the sole active owner rejects `LAST_OWNER`.

#### M10 · Self-service backup schedule contract (TS writer ↔ shell grep parser) is completely untested
- **Category:** Test coverage · **Location:** `deploy/scripts/uwe-backup.sh:25` · `packages/backup/src/schedule.ts`
- **Confidence:** HIGH · **Effort:** 1–2 h · **Quick win:** ❌
- The reference implementation of CLAUDE.md's DB-setting → host-JSON → systemd pattern is untested on both sides: `schedule.ts` (`read/writeBackupScheduleConfig`) has no unit test, and `uwe-backup.sh` parses `schedule.json` with brittle `grep -o` extraction plus untested weekly/monthly skip logic. A JSON-format change in the writer or an off-by-one in the threshold would silently skip scheduled backups; same untested pattern in `uwe-briefing.sh`/`uwe-mail-sync.sh`. **Fix:** add `schedule.test.ts` (write→read round-trip, invalid-frequency fallback, enabled coercion) and a `selfhost.test.ts`-style test running the shell parsing block against a written config.

#### M11 · D&D page-creation workflow and slug-uniqueness logic implemented directly in an API route
- **Category:** Architecture · **Location:** `apps/studio/app/api/dnd-api/route.ts:86` (319-line route)
- **Confidence:** HIGH · **Effort:** 2–4 h · **Quick win:** ❌
- Genuine domain logic in a route handler (golden-rule violation): `resolveUniquePageSlug()` implements slug-collision resolution as a `while`-loop over `repo.getPageBySlug` (this logic exists nowhere in packages — other page-creation paths can't reuse it), and the `import_statblock`/`create_encounter` branches assemble `Page`+`ContentBlock` records with inline `dm_only` visibility defaults. **Fix:** move slug-uniqueness into the repository (`createPageWithUniqueSlug`) and extract the statblock/encounter workflows into `@uwe/dnd-api` service functions; leave the route as parse→call→respond.

#### M12 · Asset/file-serving routes use blocking `fs.readFileSync` with full in-memory buffering and no HTTP caching headers
- **Category:** Performance · **Location:** `apps/studio/app/api/assets/[assetId]/file/route.ts:39` (+ portal/share/capture/scan/project/kitchen routes) · `packages/assets/src/download-headers.ts:12`
- **Confidence:** HIGH · **Effort:** 2–3 h · **Quick win:** ❌
- All binary-serving routes read the whole file synchronously on the request path (`readFileSync` blocks the event loop for the entire disk read; upload routes use `writeFileSync`). An image-heavy wiki page serializes every other request in the process. `buildAssetDownloadHeaders` sets **no** `Cache-Control`/`ETag`/`Last-Modified`, so browsers re-download every wiki image on every navigation. **Fix:** switch to `fs.promises.readFile`/`writeFile` (or stream), and add `Cache-Control: private, max-age=3600` + `Last-Modified`/`ETag` (assets are immutable per `storageKey`).

#### M13 · `listPagesForViewer` hydrates every column of every page in the world, then filters visibility in JS
- **Category:** Performance · **Location:** `packages/database/src/auth.ts:861`
- **Confidence:** HIGH · **Effort:** 3–4 h · **Quick win:** ❌
- `page.findMany({ where: { world: { slug } } })` with no `select`, no `take`, no visibility predicate, then `filterPagesForViewer` in JS — backing the portal wiki index, dashboards, NPC/place lists that slice to 6–8 items after loading everything. At mega scale this materializes 10k full rows per portal view. This is WS3 of the (proposed) perf plan; the JS filter should stay as defense-in-depth. **Fix:** push visibility/`publishStatus`/`secretLevel` predicates into the Prisma `where`, `select` only listed fields, `take` the small slices in SQL; keep `filterPagesForViewer` as a post-check and keep the authz suites green.

#### M14 · N+1 share-link query per asset on the studio asset-library page
- **Category:** Performance · **Location:** `apps/studio/app/worlds/[worldSlug]/assets/page.tsx:73`
- **Confidence:** HIGH · **Effort:** 30 min · **Quick win:** ✅
- The page maps over all assets and calls `shareService.listShareLinksForTarget(...)` per asset — one `shareLink.findMany` each. The stress seed has 200 assets/world → 200+ queries serialized on the single SQLite connection per view. **Confirmed:** loop at `:72-76`. **Fix:** one `shareLink.findMany({ where: { worldId, targetId: { in: assetIds } } })` grouped by `targetId` in JS (or a bulk `listShareLinksForTargets` method); convert `albumAssetIds` to a `Set`.

#### M15 · Budget-discipline erosion — frozen monoliths + new files consuming their headroom instead of shrinking
- **Category:** Code quality · **Location:** `scripts/file-size-baseline.json` · `packages/database/src/server.ts` (2245/2245) · `apps/studio/app/label-actions.ts` (699/700)
- **Confidence:** HIGH · **Effort:** 2–4 h (server.ts) / 0.5–1 day per monolith · **Quick win:** ❌
- The frozen `server.ts` barrel sits at **exactly** its hard ceiling (2245/2245, confirmed by `wc -l` and `SERVER_BARREL_MAX_LINES=2245`) — the next added line fails `pnpm test`. `label-actions.ts` is at exactly the 700-line new-file cap. 18 of ~28 baseline-frozen files have grown since the freeze (`settings-service.ts` +9.5%, `graph-engine.ts` +9.1%), against the CLAUDE.md rule to extract rather than add. The +10% tolerance is being consumed as growth budget; the two hottest files fail CI on the next routine edit. **Fix:** proactively extract export groups from `server.ts` (subpath exports exist), split `settings-service.ts`/`graph-engine.ts`/`label-actions.ts`, then `--ratchet` to lock lower sizes; flag any baseline-growing PR in review.

---

### 🟢 LOW

| # | Category | Finding | Location | Effort | Quick win |
|---|----------|---------|----------|--------|-----------|
| L1 | Code quality | **Nine orphaned modules (~725 lines)** never imported anywhere, including a dead `"use server"` file (`review-actions.ts` → `submitCoDmChangeAction`, making the whole co-DM change-review submit flow + its `review-bridge.ts` service + `server.ts` export dead). Also `PlayerDashboard.tsx`, `portal-navigation.ts`, `TemplateForm.tsx`, `MailTestForm.tsx`, `StudioCockpitStatusFooter.tsx`, `studio-shell-utils.tsx`, `agentJobTextProvider.ts`, `SectionPlaceholder.tsx`. Stale doc: `cleanup-inventory.md:108`. | `apps/studio/app/review-actions.ts:20` | 30–45 min | ✅ |
| L2 | Code quality | **Five unused dependencies:** `@tanstack/react-query` (studio+portal), `@hookform/resolvers` (studio+portal), `@xyflow/react` (studio — large graph lib, unused), `@uwe/soundboard` (portal), `@uwe/env` (web-search). Zero imports repo-wide (false positives like `@tiptap/pm`, `@libsql/client` excluded). | `apps/studio/package.json:27` | 15 min | ✅ |
| L3 | Code quality | **16 byte-identical UI primitive files (~740 lines)** duplicated between `apps/studio/src/components/ui/` and `apps/portal/src/components/ui/` (button, card, dialog, form, …), already diverging (`dropdown-menu.tsx` differs, `badge.tsx` studio-only). `@uwe/shared-ui` is the sanctioned home. | `apps/portal/src/components/ui/button.tsx:1` | 3–5 h | ❌ |
| L4 | Code quality | **~155 lines of 2FA activate/verify route logic duplicated** near-identically across both apps (`two-factor-routes.ts`); only guard + rate-key prefix differ — security-sensitive core copy-pasted. | `apps/portal/src/lib/two-factor-routes.ts:13` | 2–3 h | ❌ |
| L5 | Code quality | **Dead `@uwe/shared-ui` barrel exports** (no `@deprecated` marker, read as live API): `PortalNavByType`/`PortalWorldHero`, `ResizableGraphView`, `UweSessionChrome`, 3 `MobileComponents` exports (~250 lines). | `packages/shared-ui/src/PortalNav.tsx:10` | 30 min | ✅ |
| L6 | Architecture | **Layering inversion:** low-level `@uwe/security` (CSRF/guards/rate-limit, consumed everywhere) imports from feature package `@uwe/ai-brain` in 3 modules (`ai-policy.ts`, `ssrf-guard.ts`, `rtx-boundary.ts`), pulling the whole AI package into everything that wants a rate limiter. Imported subpaths are pure leaves — coupling is a graph artifact. | `packages/security/src/security/ai-policy.ts:5` | 2–4 h | ❌ |
| L7 | Performance | **Admin cross-domain search runs ~14 table scans sequentially** on the command-palette hot path (one `contains`-LIKE `findMany` per entity type, awaited in series → latency is the sum, not the max). | `packages/database/src/admin-search-service.ts:134` | 1 h | ❌ |
| L8 | Performance | **`ActivityLog` lacks an index on `action`** though three request-path sites (incl. every `/today` render) run `findFirst({ where: { action: "backup_created" }, orderBy: { createdAt: desc } })`, degrading to a partial table scan on fresh/old-backup hosts. **Confirmed:** only `[worldId,createdAt]`, `[createdAt]`, `[undoEntryId]` indexes exist. | `packages/database/prisma/schema.prisma:1481` | 15 min | ✅ |
| L9 | Dependencies | **Moderate advisory GHSA-92pp-h63x-v22m** (`@hono/node-server` <1.19.13, middleware bypass via repeated slashes) — installed 1.19.11, pinned by `@prisma/dev` via `prisma`. Only runs inside `prisma dev`, never in production; invisible to CI gate (`--audit-level high`). **Confirmed** via `pnpm audit --prod`. | `packages/database/package.json:77` | 15 min | ✅ |
| L10 | Dependencies | **Moderate advisory GHSA-qx2v-qp2m-jg93** (`postcss` <8.5.10, XSS via unescaped `</style>`) — 8.4.31 pinned exactly inside `next@15.5.19`; only processes first-party build-time CSS. **Confirmed** via `pnpm audit --prod`. | `apps/portal/package.json:40` | 30 min | ✅ |
| L11 | Dependencies | **Unused `@next/env ^16.2.9` devDependency in portal** while `next` is major 15 (ships its own matched `@next/env@15.5.19`) — a version-consistency trap. | `apps/portal/package.json:51` | 10 min | ✅ |
| L12 | Test coverage | **2FA login-challenge negative paths untested** (expiry branch, wrong code) and TOTP lacks RFC 6238 vectors / window-boundary tests. Deterministic (injectable `nowMs`), so depth-of-coverage rather than an active defect. | `packages/database/src/two-factor-service.ts:115` | 45 min | ✅ |
| L13 | Test coverage | **Fixed 20 ms sleeps in connector runner tests** (`setTimeout(r, 20)` as a dispatch-finished proxy) — CI-flake risk on loaded runners. The only real-time coupling found in the unit suites. | `tools/uwe-rtx-connector/src/runner.test.ts:89` | 20 min | ✅ |
| L14 | Architecture | **Frozen `server.ts` barrel 4 lines below its hard cap** (2246 vs ~2250 budget, 61 lines added post-freeze) — same tolerance-consumption pattern as M15, on the single most-imported module (~440 importers). *(Overlaps M15; listed for the architecture lens.)* | `packages/database/src/server.ts:1` | 1–2 h | ❌ |

---

## Quick Wins (fixable in under 30 minutes each)

Ordered by value. Together these close the CRITICAL, two MEDIUM security gaps, several test gaps, and two dependency advisories.

1. **C1 — Owner-gate the restore-execute route** (30 min) — the single highest-value fix. Add a server-side `canRestoreBackup(role)` / `requireOwnerApiAuth` check.
2. **M1 — Owner-gate the restore-preview route** (30 min) — same pattern; stops `dm`/`admin` enumerating backup contents.
3. **H4 — De-duplicate `/today` dashboard compute** (30 min) — pass `adminStatus`/`lifeSummary` into `getHomelabCockpitData`; halves the budgeted hot path.
4. **H6 — Add `encrypt.test.ts` for backup encryption** (30 min) — protects the primary data-loss safety net from silent unrestorability.
5. **M14 — Batch the asset-library share-link N+1** (30 min) — one `findMany … targetId: { in: … }` replaces 200+ queries.
6. **M9 — Test `deleteUser` owner-lockout guards** (20 min) — two tests for `CANNOT_DELETE_SELF` / `LAST_OWNER`.
7. **L8 — Add `@@index([action, createdAt])` to `ActivityLog`** (15 min) — index-seek for `/today` backup lookups (needs a migration per the `uwe-database-migrations` skill).
8. **L2 — Remove five unused dependencies** (15 min) — smaller install + audit surface.
9. **L9 / L10 — Add `pnpm.overrides` for `@hono/node-server >=1.19.13` and `postcss >=8.5.10`** (15–30 min) — clears both moderate advisories.
10. **L11 — Remove the stray `@next/env ^16.2.9` from portal** (10 min).
11. **L5 — Delete unmarked dead `@uwe/shared-ui` exports** (30 min) and **L1 — delete the nine orphaned modules** (30–45 min).

---

## What is healthy (verified, not flagged)

- **Studio API authz** — every route enumerated and asserted guarded by `scripts/studio-route-auth.test.ts`; CSRF enforced on mutating routes.
- **Injection** — all `$queryRawUnsafe` calls use constant strings; wiki/mail HTML is DOMPurify-sanitized before `dangerouslySetInnerHTML`; asset paths are traversal-checked.
- **Secrets** — none tracked; `.env.example` ships placeholders; `secret:scan` runs in CI.
- **`dm_only` / secret visibility** — centralized in `packages/database/src/permissions.ts`, enforced at the data layer, with regression tests (`visibility-leak`, share-link `dm_only`-bypass, static-export exclusion, public-leak-scanner) across Portal and static export.
- **Dependency & license hygiene** — all key frameworks on current majors; clean license profile (no GPL/AGPL in production); no duplicated majors of significant libs; the `nodemailer ^9.0.1` override is still needed and consistent.
- **Test breadth** — 449 test files, all green with zero skips across every workspace package.
- **Module discipline** — a real, enforced file-size budget + baseline-freeze system (the erosion in M15 is *within* tolerance today, caught early by this audit).

---

## Method note & completeness

This report was produced by a 6-agent parallel audit (one per category) with per-finding adversarial verification. The verification phase was interrupted partway by an account spend limit; the auditor findings were recovered from the workflow journal and **each surfaced finding was re-verified directly in this session** against the current source (guard code read in full for C1/M1; circular dep confirmed in both `package.json`s; `/today` double-compute confirmed at `homelab-dashboard.ts:72,120`; `pnpm audit --prod` re-run to confirm L9/L10; file-size ceilings, missing indexes, N+1 loops, and zero-test claims each confirmed by direct grep/read). No finding is speculative; all are HIGH-confidence. Findings that could not be confirmed were dropped rather than padded.
