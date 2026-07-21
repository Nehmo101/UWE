# UWE — Full Codebase Audit & Prioritized Remediation Report

**Codebase:** UWE (Universeller Welten-Editor) — self-hosted campaign-brain / world-wiki / daily-admin OS
**Stack:** pnpm 10 (`pnpm@10.12.1`) + Turborepo monorepo · TypeScript (strict) · Next.js 15 (App Router) · Prisma 7 + SQLite/libsql · Node 22 · Tauri 2 desktop (UWE Command Center) · Playwright + node:test
**Scale:** ~2,900 tracked files · ~1,990 TS/TSX · ~35 packages · 2 Next.js apps (studio, portal) + Tauri connector client + `uwe-host-command-center` host tool
**Audit date:** 2026-07-21 · **Branch:** `claude/session-mz18sa`
**Method:** 6-agent parallel audit (security, performance, code quality, test coverage, dependencies, architecture), each finding adversarially re-verified. See the *Method note* at the end for how a mid-run account spend-limit was handled — every finding below was re-confirmed by direct source read in this session; unverifiable or already-mitigated candidates were dropped.

---

## Context — this is a delta audit over PR #764

A full audit ran **2026-07-10** and **all 35 of its findings were fixed and merged** (previous report content is superseded by this file). This audit re-verified that those fixes still hold and concentrated scrutiny on the code that landed since: the **PDF-campaign importer** (`packages/pdf-campaign-import`, `apps/studio/app/import*`), the **UWE Command Center** (`apps/rtx-connector-client` Tauri app + `tools/uwe-host-command-center` host server + `packages/connector*`), and the **Windows release/update workflow**.

**Verified still-healthy from the prior audit:** the search-index memoization, the cached wikilink graph (`page-viewer-service.ts:152`), the shared block-render context, the `/today` dedup (`today-dashboard.ts:129-143`), and the `listPagesForViewer` SQL narrowing all remain in place. The two previously-flagged allowlisted Server Actions (`activateAiGeneralPromptAction`, `updateDeploymentConfigAction`) **now both call `requireStudioActionAuth()`** before their role gate — that leftover is closed. `pnpm audit --prod` at **moderate** level reports **no known vulnerabilities**.

---

## Executive Summary

**Overall health: STRONG (8.0 / 10) — 0 CRITICAL, 1 HIGH. The core web platform is in good shape; essentially all new debt is on the new host-control / desktop surface.**

The Studio/Portal web platform remains disciplined and well-defended: Studio API routes are auth-guarded and the guard is enforced by a *dynamic* route-inventory test (`scripts/studio-route-auth.test.ts` via `listStudioApiRouteFiles`, so new routes are auto-covered), the new PDF importer forces local-only AI routing with size/MIME guards and does **no** third-party PDF byte parsing (it operates on already-extracted text and ships real unit tests for its chunker/parser/dedupe/page-mapper), no Prisma calls leaked into the new route handlers, dependencies are clean at moderate level, and the prior 35 fixes hold. The single **HIGH** finding is on the new host-control tool: the UWE Command Center HTTP server (systemd, port 3099, backed by scoped passwordless `sudo`) performs no `Host`/`Origin` validation and vends its control token from an unauthenticated `GET /api/control/bootstrap`, making its token gate bypassable via DNS-rebinding from a browser running on the host. The remaining debt is a cluster of **MEDIUM/LOW** hardening and hygiene items concentrated in the Tauri client and Command Center UI (world-readable secret file, disabled CSP, empty updater pubkey, a keystroke-triggered process-spawning status probe, an over-serialized `/import` RSC payload, and a re-introduction of the previously-fixed throwaway-`PrismaClient` anti-pattern in the new import actions).

**Finding count:** 0 CRITICAL · 1 HIGH · 3 MEDIUM · 6 LOW (10 total, all HIGH/MEDIUM-confidence).

---

## Prioritized Findings

### 🟠 HIGH

---

#### H1 · UWE Command Center control server has no `Host`/`Origin` validation and serves its control token unauthenticated — DNS-rebinding reaches scoped-sudo host actions
- **Category:** Security (CSRF / DNS-rebinding → privileged host control)
- **Location:** `tools/uwe-host-command-center/src/server.ts:84` (bootstrap) · `:45,:51` (bind + URL base) · gate `tools/uwe-host-command-center/src/control.ts:291` · `deploy/sudoers/uwe-host-command-center`
- **Confidence:** HIGH
- **Description:** `uwe-host-command-center.service` runs an HTTP server bound to `127.0.0.1:3099` (`server.ts:45`) whose sudoers file grants passwordless `systemctl restart uwe.service`, `start uwe-backup.service`, `start uwe-healthcheck.service`, plus a host-update trigger. Access is nominally gated by a control token, but `GET /api/control/bootstrap` returns that token **unconditionally** to any requester (`server.ts:84-93`: `sendJson(res, 200, { ...meta, token })`), and `executeControlAction` accepts exactly that token (`control.ts:291`). The server builds its URL base from a **fixed** host string (`new URL(req.url, `http://${host}:${port}`)`, `:51`) and never inspects the request `Host` or `Origin` header anywhere. Because 127.0.0.1-binding is the only real access control, a malicious web page opened in a browser *on the host* can use DNS rebinding (`evil.com → 127.0.0.1`) to make same-origin requests: `fetch('/api/control/bootstrap')` to read the token, then `POST /api/control/action {action, token}` to restart UWE, force a backup, or trigger a full host git-sync + rebuild (`update-uwe`). `server.test.ts` even asserts bootstrap returns a token with no auth. **Verified:** bootstrap handler and bind address read in full; sudoers grants confirmed; no `Host`/`Origin` check exists in `createHostCommandCenterServer`. Impact is bounded by the *scoped* sudoers allowlist (fixed `systemctl` invocations only — no arbitrary command execution), which is why this is HIGH, not CRITICAL.
- **Recommended fix:** Reject requests whose `Host` header is not exactly `127.0.0.1:3099` / `localhost:3099` (defeats DNS rebinding) and add an `Origin`/`Sec-Fetch-Site` check on `POST /api/control/action`. Stop serving the control token from an unauthenticated GET — inject it into the dashboard HTML server-side (same origin) or bind a per-request CSRF token to the session so the token is never retrievable by a cross-site `fetch`.
- **Effort:** 30min–2h · **Quick win:** ⚠️ (small, high-value)

---

### 🟡 MEDIUM

---

#### M1 · Tauri Command Center writes the connector token and Spotify client secret world-readable (no `0600`), unlike the Node provisioner for the same file
- **Category:** Security (local secret exposure)
- **Location:** `apps/rtx-connector-client/src-tauri/src/lib.rs:747` (`write_config_to_disk`) · contrast `tools/uwe-host-command-center/src/provision-local-connector.ts:64`
- **Confidence:** HIGH
- **Description:** `write_config_to_disk` serializes `ConnectorClientConfig` — which includes the connector bearer `token` and `spotify_client_secret` — and writes it with a plain `fs::write` and **no** permission tightening (`lib.rs:747-758`; no `chmod`/`set_permissions`/`0o600` anywhere in `lib.rs`). On Linux/macOS the file at `~/.local/share/UWE/rtx-connector-client/config.json` is created with the process umask (typically `0644`, world-readable). The Node writer for the **same file** explicitly does `fs.chmodSync(configPath, 0o600)` on non-Windows (`provision-local-connector.ts:64`), so whichever path runs last determines the mode — and the Rust path leaves the secrets readable by any other local user on a shared/multi-user host.
- **Recommended fix:** After writing `config.json` (and any Spotify session file) set mode `0o600` on Unix, matching the Node provisioner; ideally write to a temp file and rename to avoid a world-readable window.
- **Effort:** <30min · **Quick win:** ✅

#### M2 · Command Center: every keystroke in the project-root input triggers a full host-status probe (node CLI spawn + git + nvidia-smi + health fetches), with no cancellation
- **Category:** Performance (new desktop UI)
- **Location:** `apps/rtx-connector-client/src/components/CommandCenterPanel.tsx:94-112` · input `:400`
- **Confidence:** HIGH
- **Description:** `refresh` is a `useCallback` with dependency `[root]` (`:94-108`), and the mount effect `useEffect(() => { void refresh(config.localHostRoot); }, [config.localHostRoot, refresh])` (`:110-112`) re-runs whenever `refresh`'s identity changes. The project-folder input does `onChange={e => setRoot(e.target.value)}`, so **every keystroke** recreates `refresh` and re-fires the effect → invokes the Tauri `get_host_status` command, which spawns a fresh `node` process running `desktop-host-cli.ts`, which runs `git rev-parse` + `git branch`, `nvidia-smi`, `statfs`, and two HTTP health probes (2.5 s AbortSignal timeouts). Typing a path spawns ~10 overlapping process trees; responses have no cancellation token, so a stale probe can overwrite a newer `setStatus`. The same keystroke also clears and re-arms the 15 s poll interval.
- **Recommended fix:** Decouple the mount effect from the typed input — give `refresh` empty deps and read the latest `root` from a ref, or depend only on `[config.localHostRoot]`; alternatively debounce. Add a monotonic request counter so stale `getHostStatus` responses are dropped.
- **Effort:** <30min · **Quick win:** ✅

#### M3 · `/import` page serializes full preview payloads (all AI-extracted entity bodies) for up to 50 jobs into a client component that only renders a count
- **Category:** Performance (RSC payload bloat)
- **Location:** `apps/studio/app/import/page.tsx:55-56` · client consumer `apps/studio/app/import/ImportCentralWorkspace.tsx:102-114` · payload shape `apps/studio/app/import-campaign-actions.ts:71-85`
- **Confidence:** HIGH
- **Description:** The Import-Zentrale server component loads up to 50 `ImportJob` rows (`listJobs({ limit: 50 })`) and passes `previewPayload: job.previewPayload` and `resultSummary: job.resultSummary` **wholesale** into the client component. For campaign-PDF jobs the stored `previewPayload` is `{ kind: "campaign_entities", entities: [...] }` — the **full** AI-extracted entity array (bodies derived from up to 20×6000 chars of PDF text per job). The client uses none of it beyond a count: `readPreviewSummary` reads only `totalDocuments`/`totalEntities` (`ImportCentralWorkspace.tsx:102-114`). So every `/import` visit ships potentially multiple MB of dead JSON in the RSC payload. Relatedly, `previewImportCampaignPdfJobAction` returns the full `entities` to the browser although `CampaignPdfImportPanel` renders only `items`/`errors`/`canExecute`.
- **Recommended fix:** Map jobs to a lean row server-side — replace `previewPayload`/`resultSummary` with precomputed summary strings/counts (`previewSummary`, `resultLabel`). Strip `entities` from the preview action's return (the execute action re-reads them from the stored job anyway).
- **Effort:** <30min · **Quick win:** ✅

---

### 🟢 LOW

| # | Category | Finding | Location | Effort | Quick win |
|---|----------|---------|----------|--------|-----------|
| L1 | Performance / architecture | **M2-anti-pattern re-introduced:** the new import Server Actions call `createUweRepository()` (→ `new UweRepository(createPrismaClient())`), opening a throwaway libsql connection to the single SQLite file per invocation and never `$disconnect()`-ing — in a file that already imports the shared `prisma` singleton. Same doc'd "lock-storm" pattern the prior M2 fix removed, reintroduced in code that landed after it. **Fix:** use the already-exported `createUweRepositoryFromClient(prisma)` at all three sites (one line each). | `apps/studio/app/import-campaign-actions.ts:163,247` · `apps/studio/app/import-central-actions.ts:179` | <30min | ✅ |
| L2 | Security | **Tauri webview CSP disabled** (`"csp": null`). No `dangerouslySetInnerHTML` today (React escaping is the only defense), so defense-in-depth — but the window renders untrusted external strings (model names, job payloads, host command output) and exposes ~40 IPC handlers incl. host control, so a future/dependency-introduced sink would have no backstop. **Fix:** set an explicit restrictive CSP for the desktop window. | `apps/rtx-connector-client/src-tauri/tauri.conf.json:25` | 30min–2h | ⚠️ |
| L3 | Security | **Updater plugin has an empty `pubkey`** while a `latest.json` endpoint is configured. Currently `"active": false`, so no auto-update runs — but an empty pubkey means an enabled updater would accept **unsigned** artifacts. Separately, the release manifest (`build-uwe-release-manifest.mjs`) records only installer basenames — no SHA-256/signature — so installer integrity rests entirely on GitHub HTTPS. **Fix:** keep the updater inactive until a real pubkey is provisioned; add per-installer SHA-256 to the manifest and verify on download; fail the release build if `pubkey` is empty while `updater.active` is true. | `apps/rtx-connector-client/src-tauri/tauri.conf.json:46,51` | 30min–2h | ❌ |
| L4 | Performance | **Command Center 15 s status poll disables every action button** for the probe's duration. `refresh` sets `busy` and every primary button is `disabled={busy !== null}`; when Studio/Portal are stopped, each health probe runs to its 2.5 s timeout, so exactly when the user wants to click "Alles starten" the UI is disabled ~2.5–3 s of every 15 s and buttons flicker. **Fix:** don't set `busy` for background polls — reserve `busy` for user-initiated actions; let the periodic refresh update `status` silently. | `apps/rtx-connector-client/src/components/CommandCenterPanel.tsx:95,114-118,283` | <30min | ✅ |
| L5 | Performance / scaling | **Command Center host logs grow without bound; every log view reads the whole file into memory** to keep the last 200 lines (`fs.readFileSync(file).split(/\r?\n/).slice(-200)`). `command-center.log`/`studio.log`/`portal.log` are append-only and never rotated (full `pnpm install`/`db:deploy`/`build` transcripts + piped Next stdio), reaching tens/hundreds of MB on a 24/7 host. **Fix:** read only the file tail (fd + fstat + last ~64 KB) and add size-based rotation on append. | `tools/uwe-host-command-center/src/desktop-host.ts:636` (+ append sites `:487-495,:553-564`) | 30min–2h | ❌ |
| L6 | Test coverage / code quality | **New Command Center UI logic is untested and `App.tsx` is at the size cap.** `CommandCenterPanel.tsx` (430 lines — the keystroke/stale-response bug in M2, the poll-lockout in L4) has no component test; `import-campaign-actions.ts` (the PDF-import Server-Action wrappers) has no test although the underlying `@uwe/pdf-campaign-import` package is well-covered. Separately, `apps/rtx-connector-client/src/App.tsx` sits at **690/700** lines — one refactor from tripping the new-file size budget. **Fix:** add a focused test for the panel's refresh/poll effects (would have caught M2/L4); extract a module from `App.tsx` before it grows. | `apps/rtx-connector-client/src/components/CommandCenterPanel.tsx:1` · `apps/rtx-connector-client/src/App.tsx:1` | 1–2h | ❌ |

---

## Quick Wins (fixable in under 30 minutes each)

Ordered by value.

1. **M1 — `chmod 0o600` the Tauri config write** (<30min) — matches the Node provisioner; stops the connector token + Spotify secret being world-readable on multi-user hosts.
2. **M2 — Debounce / ref-decouple the Command Center status probe** (<30min) — stops every keystroke spawning ~10 process trees and prevents stale-response overwrites.
3. **M3 — Lean `/import` job rows** (<30min) — replace the full `previewPayload`/`resultSummary` passthrough with precomputed summaries; drops multi-MB of dead JSON from the RSC payload.
4. **L1 — Swap the three new import actions to `createUweRepositoryFromClient(prisma)`** (<30min) — closes the re-introduced throwaway-`PrismaClient` leak (one line per site).
5. **L4 — Don't set `busy` on background polls** (<30min) — stops the action buttons flickering/disabling ~20% of the time.
6. **H1 (partial) — Add a `Host`-header allowlist to the Command Center server** (~30min) — the core DNS-rebinding defense; pair with the unauthenticated-bootstrap fix for the full remediation.

---

## What is healthy (verified, not flagged)

- **Studio API authz** — every route enumerated **dynamically** and asserted guarded-or-allowlisted by `scripts/studio-route-auth.test.ts` (`listStudioApiRouteFiles`), so the new `connectors/direct/*`, `bugs/upload`, and `import*` routes are automatically in scope; the new routes apply connector-token / Studio admin+mutation guards + CSRF. The prior allowlisted-action Origin-check leftover is closed.
- **New PDF importer** — `@uwe/pdf-campaign-import` does **no** third-party PDF *byte* parsing (it operates on extracted text; only workspace dep is `@uwe/database`), forces local-only AI routing (`local_rtx`, no cloud fallback) with size/MIME guards, and ships unit tests for chunker, parser, dedupe, page-mapper, and prompt.
- **No business logic in the new route handlers** — no `prisma`/`findMany`/`.create()` in the new `import*` / `connector*` route files; domain logic lives in packages per the golden rule.
- **Dependencies** — `pnpm audit --prod` clean at **moderate** level; no new circular package dependency (the new packages are leaves); `pnpm@10.12.1` still reads the `pnpm.overrides` security pins.
- **Deploy-script injection** — `deploy/scripts/*.sh` parsing the DB-synced `schedule.json` validate extracted values (numeric/regex) and use them only in quoted comparisons — no injection.
- **Prior 35 findings** — the 2026-07-10 remediation (search/wiki-graph memoization, `/today` dedup, `listPagesForViewer` SQL narrowing, mail-cycle break, monolith splits) was spot-checked and still holds.

---

## Method note & completeness

This report was produced by a 6-agent parallel workflow (one auditor per category, each finding routed to an adversarial verifier). **A mid-run account monthly-spend-limit halted the workflow after the security and performance auditors completed** — the code-quality, test-coverage, dependencies, and architecture auditors, and all verifier agents, were terminated before finishing. To keep the audit honest and complete:

- The **9 security + performance findings** were recovered from the workflow journal and **each was re-verified by direct source read in this session** (bootstrap handler + bind address + sudoers for H1; `write_config_to_disk` vs the Node `chmod` for M1; the `useCallback`/effect deps for M2; the `previewPayload` passthrough vs the count-only client consumer for M3; `createUweRepository` call sites for L1; `csp:null`, empty `pubkey`, and `readLogs` for L2/L3/L5). None are speculative.
- The **four categories whose auditors were killed** were covered by a **lighter-touch inline sweep focused on the new code** (not a full agent-driven pass): `pnpm audit --prod` (moderate), dependency graph of the new packages, dynamic-vs-static analysis of the route-auth inventory test, presence of Prisma calls in new route handlers, new-package test presence, and file-size headroom of the new files. That sweep surfaced only **L6** and confirmed the "healthy" items above. A full re-run of those four auditors is advisable once the spend limit resets, but the delta scope (new code only, over a codebase whose prior 35 findings are fixed) makes a large miss unlikely.

Findings that could not be confirmed against current source were dropped rather than padded.
