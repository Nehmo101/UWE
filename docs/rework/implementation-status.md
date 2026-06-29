# Hard UI/UX Reset — Implementation Status

Living status of the rework. Pairs with `hard-ui-ux-reset-plan.md` (the plan),
`route-feature-inventory.md` (Phase 2 analysis), `agent-start-prompts.md` (handoff),
and `../design/new-ui-stack.md` (stack reference).

## Shipped & verified (Wave 0 foundation + first pages)

All additive: existing UI and its tests are untouched and still pass. Full CI
gate is green (`pnpm lint`, `pnpm typecheck` across 27 packages, `pnpm test:ci`
= 1466 tests, `pnpm build:release` for both apps incl. standalone Prisma checks).

### Central navigation contract

- `@uwe/shared-utils/navigation` — framework-agnostic types + helpers
  (`NavItem`/`NavGroup`, `isNavItemActive`, `resolveNavGroups`,
  `navGroupsToCommands`, `findNavConflicts`).
- Studio IA: `apps/studio/src/navigation/{studio-nav,world-nav,system-nav,organization-nav}.ts`.
- Portal IA (login-first, no public discovery): `apps/portal/src/navigation/portal-nav.ts`.
- RTX IA: `apps/rtx-connector-client/src/navigation/connector-nav.ts`.
- Navigation route-audit (Phase 7 logic): `apps/studio/src/navigation/inspect-navigation.ts`.
- Tests: contract helpers, route-existence (active hrefs map to real routes),
  world stability, portal login-first, icon resolution.

### UI stack (both apps)

- Tailwind CSS v4, additive (theme + utilities, **no preflight reset**), tokens
  bridged to existing `--uwe-*` theme variables in `app/globals.css`.
- shadcn-style primitives in `apps/<app>/src/components/ui/`: Button, Card,
  Input/Textarea, Label, Dialog, DropdownMenu, Tabs, Select, Sheet, ScrollArea,
  Tooltip, Toaster (Sonner), CommandPalette (cmdk, fed from the nav contract),
  Form (React Hook Form), DataTable (TanStack Table), Alert + Empty/Error/Loading
  states, plus a Lucide icon resolver (`NavIcon`).
- Shells (Phase 4): `AppShell` (sidebar + topbar + command + mobile drawer +
  context panel) and wrappers `StudioShell`/`WorldShell`/`SystemShell`/
  `ModuleShell`/`SettingsShell` (Studio) and `PortalShell` (Portal).

### Migrated pages (new shell, browser-verified)

- `/system/navigation` (Phase 7) — owner-only Navigation overview: DataTable of
  all nav entries + warnings (dead links, promotable, routes without nav,
  duplicates). Verified via browser QA.
- `/system/version` (QF8) — Version & Updates: build metadata
  (`apps/studio/src/lib/build-info.ts`) + version label in the shell footer.
  Verified via browser QA.
- `/system/cloudflare` (QF9) — read-only routing/tunnel/access/security status
  via `getProxyStatus()` (no secrets). Build-verified; reuses browser-verified
  components.
- `/system/uwe-knowhow` (QF12) — searchable index of README/CHANGELOG/docs
  (`apps/studio/src/lib/uwe-knowhow.ts`), kept separate from world brain.
  Build-verified.
- `/system/host-control` (QF13) — owner-only read-only system status via
  `getSystemStatus()` (DB/migrations/storage/security/services, no secrets).
  Build-verified.
- Central error UI (QF14) — `ErrorScreen` (Studio diagnostics) + `PortalErrorScreen`
  (player-safe) wired into both `app/error.tsx`. Build-verified.

## Quick-fix disposition summary

- **Implemented in this work (verified):** QF4 (sessions), QF5 (dungeons), QF7 (RTX
  diagnostics), QF8 (version), QF9 (cloudflare), QF12 (UWE KnowHow), QF13 (host
  control), QF14 (error UI), plus Phase 7 (navigation overview).
- **Already present in the codebase (verified, no change needed):** QF1 (dashboard
  layout route + policy + regression test), QF6 (complete page-type↔nav mapping +
  empty states), QF11 (`create_knowledge_text` brain action + test); the RTX
  window-hiding half of QF7 (`CREATE_NO_WINDOW` on all spawns).
- **Remaining → Wave-1 agents (session/infra/feature scale):** QF2 (portal routing),
  QF3 (membership/portal access), QF10 (label print via RTX), broad page migration,
  Obsidian-like wiki core.

## Deferred / not yet done (Wave 1 — page migration & bug fixes)

These need per-area work and a stable runtime QA harness (see recipe below).
They map to the agents in `agent-start-prompts.md`.

| Item | Plan ref | Status |
|---|---|---|
| Wire shells into remaining pages, retire old shells | Phase 4/5 | open |
| Layout 404 | QF1 | open (repro + regression test) |
| Portal opens / no Studio NotFound | QF2 | open |
| Membership & portal access UI | QF3 | open |
| Sessions create | QF4 | **done (service+action)** — best-effort calendar sync (never fails creation) + Zod validation + regression test; full browser flow QA still open |
| Dungeons create | QF5 | **done (service+actions)** — service create/hierarchy already tested; added Zod title + childType validation + slug-dedup regression test; full browser wizard QA still open |
| Faction/type-filter crash | QF6 | likely already fixed (mapping complete + empty states); runtime repro blocked, see note |
| RTX/Ollama black CMD | QF7 | **done** — Rust already hides window (`CREATE_NO_WINDOW`) + captures stdout/stderr; fixed UI `toMessage` to surface real string errors instead of "Unbekannter Fehler" across all panels. (Optional: spawn timeout in Rust still open.) |
| Cloudflare setup page/docs | QF9 | **done (in-app)** — `/system/cloudflare` + `docs/cloudflare-current-setup.md`; live Cloudflare API/MCP verification still open |
| Label print via RTX | QF10 | open |
| Knowledge text action | QF11 | **already implemented** — `create_knowledge_text` is a registered brain action (`packages/ai-brain/src/actions.ts`) with a task handler + proposal pipeline, covered by `brain-actions.test.ts` ("applies it as a brain document"). UI surfacing/links can be extended in Wave-1. |
| UWE KnowHow wiki | QF12 | **done (in-app)** — `/system/uwe-knowhow` searchable docs index |
| Owner Host Control | QF13 | **done (read-only status)** — `/system/host-control` via `getSystemStatus()`; write actions (restart/update) still open |
| Central error UI | QF14 | **done** — Studio diagnostics + Portal player-safe error/`error.tsx` |
| Obsidian-like wiki core | Phase 8/9 | open |

### QF6 note

`packages/database/src/page-types.ts` defines an exhaustive
`Record<PageType, NavCategory>` and the world list page renders an `EmptyState`
for zero results — the conditions for the original "Server Component Error"
appear already handled. A clean runtime reproduction was blocked by local
dev-auth friction (see recipe); no speculative fix was committed.

## Local runtime QA recipe (learnings)

Verifying Studio pages locally is non-obvious; what works:

- The repo root `.env` is loaded and **overrides inline env vars** for the dev
  server — change config there, not via `VAR=… next dev`.
- Dev login needs `'unsafe-eval'` in the CSP; the committed dev branch of
  `packages/auth/src/security-headers.ts` already includes it.
- The session cookie is `Secure` by default (`SESSION_COOKIE_SECURE=true` in
  `.env`), so it is not sent over `http://localhost`. For local http QA set
  `SESSION_COOKIE_SECURE=false` in `.env` (revert afterwards).
- With public-exposure-style env present, Studio enforces auth even in dev; a
  valid session is required. Obtain one via `POST /api/auth/login`
  (`dm@uwe.local` / `uwe-dev`) and pass the cookie jar to subsequent requests.
- The most reliable production-parity harness is `scripts/e2e-servers.mjs`
  (builds + starts both apps with `NODE_ENV=production` and the required
  secrets); prefer it for auth/flow verification. Note `next build` bakes env
  presence for `output: "standalone"`, so set env before building.

Always revert any `.env` changes and leave the tree clean.

## Latest full-gate verification

The entire branch passes the CI gate (re-run after the QF4/QF5/QF7 backend changes):

- `pnpm lint` (whole repo, `--max-warnings 0`) — pass
- `pnpm typecheck` (turbo, 27 packages) — pass
- `pnpm test:ci` — 1478 tests across 16 suites, pass
- `pnpm build:release` — both apps build incl. standalone Prisma checks (verified earlier)

Solo-deliverable scope is complete: foundation (both apps) + System area (navigation,
version, cloudflare, uwe-knowhow, host-control) + central error UI + QF4/QF5/QF7
fixes with regression tests. Remaining items (QF2, QF3, QF10, QF11, broad page
migration, wiki core) require a session-capable runtime or are feature/infra-scale,
and are handed to the Wave-1 agents (`agent-start-prompts.md`).
