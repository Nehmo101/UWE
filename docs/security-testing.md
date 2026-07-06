# Security Testing

Automated security tests for UWE ensure that private campaign content never leaks through public portal paths and that sensitive Studio API routes stay protected.

## Quick start

```bash
pnpm install
pnpm --filter @uwe/database db:generate

# Full security suite (authz + leak scanner)
pnpm test:security

# Role matrix + route guards only
pnpm test:authz

# Public leak scanner only
pnpm test:leaks
```

Pull requests with code changes run `pnpm test:security` as part of `pnpm ci:light:pr:gate` (see `.github/workflows/pr-check.yml`). Docs-only PRs skip the heavy gate.

## What is tested

| Suite | Command | Scope |
|-------|---------|--------|
| **Role matrix** | part of `test:authz` | Anonymous, PLAYER, DM, ADMIN, OWNER access to pages, blocks, assets |
| **Route authorization** | part of `test:authz` | Studio `/admin`, `/api/admin/*`, `/api/import/*`, `/api/brain/*`, `/api/ai/*`, search, Portal `/worlds/*`, player management |
| **Studio route inventory** | part of `test:authz` | Every Studio API route must call `requireStudioApiAuth`, `requireRestoreOwnerAuth`, or be explicitly allowlisted |
| **Public leak scanner** | `test:leaks` | All anonymous portal data paths scanned for private test markers |
| **Leak smoke inventory** | part of `test:leaks` | Ensures portal visibility, share-link, search, graph, asset, and permission leak tests stay present |

Package: `@uwe/security-tests` (`packages/security-tests/`).

## Role mapping

UWE uses four runtime roles (`owner`, `dm`, `player`, `guest`). The security suite maps the requested test roles as follows:

| Test role | UWE implementation | Notes |
|-----------|-------------------|--------|
| **anonymous** | No session → `guest` | Public `/worlds/*` portal context |
| **PLAYER** | `player` world membership | Authenticated `/auth/worlds/*` |
| **DM** | `dm` system + world membership | Full world content in Studio/Portal |
| **ADMIN** | System `owner`, world `dm` on public world | Daily Admin OS operator; system owner fallback applies on worlds without membership |
| **OWNER** | System + world `owner` | Full control including private worlds |

There is no separate `ADMIN` enum in Prisma — “Admin” in the UI refers to the Daily Admin OS cockpit, not a distinct permission bit.

## Test fixtures

Each run seeds an isolated SQLite database with labeled content:

| Fixture | Visibility / status | Marker string |
|---------|---------------------|---------------|
| Public page | `public`, published | `__PUBLIC_MARKER_OK__` |
| Player-visible page | `player_visible`, published | `__PLAYER_VISIBLE_MARKER_OK__` |
| DM-only page | `dm_only`, published | `__DM_ONLY_SECRET_SHOULD_NOT_LEAK__` |
| Private draft | `player_visible`, draft | `__PRIVATE_DRAFT_SHOULD_NOT_LEAK__` |
| Hidden secret | `unlock_after_session`, not unlocked | `__HIDDEN_SECRET_SHOULD_NOT_LEAK__` |
| Revealed secret | `unlock_after_session`, unlocked for test player | `__REVEALED_SECRET_MARKER__` |
| Public media | `public` asset | file contains public marker |
| Private media | `dm_only` asset | `__PRIVATE_MEDIA_SHOULD_NOT_LEAK__` |

Two worlds are seeded:

- **`sec-public-world`** — guest mode enabled; primary leak-scan target
- **`sec-private-world`** — guest mode disabled; DM-only content only

## Public leak scanner

The scanner simulates every anonymous portal data path (no HTTP server required):

- World and page listings (`listPagesForContext`, `getPublicPageForPortal`)
- Asset listings and single-asset fetches
- Portal search (`search` with `portal` context)
- Portal graph (`buildWorldGraph` with `portal` context)

It fails immediately if any response body contains:

- `__DM_ONLY_SECRET_SHOULD_NOT_LEAK__`
- `__PRIVATE_DRAFT_SHOULD_NOT_LEAK__`
- `__HIDDEN_SECRET_SHOULD_NOT_LEAK__`
- `__PRIVATE_MEDIA_SHOULD_NOT_LEAK__`

A dedicated regression test asserts the scanner would catch a deliberate poisoned payload.

## Route coverage notes

| Requested path | UWE location |
|----------------|--------------|
| `/studio` | Studio app root (`http://localhost:3000/`) — no `/studio` prefix |
| `/admin` | `apps/studio/app/admin/*` |
| `/api/search/*` | `apps/studio/app/search/page.tsx` + `apps/studio/app/api/command/search/route.ts` |
| `/players/*` | Not implemented — players managed via `WorldMembership` and `POST /api/mail/recipients` (`sync_players`) |

Studio API routes require session login (or bearer token) plus CSRF protection; optional `STUDIO_API_TOKEN` for extra hardening. Portal `/worlds/*` relies on repository visibility filters and optional production middleware (`AUTH_REQUIRED`).

## Acceptance criteria

- **DM-only leak:** `public-leak-scanner.test.ts` fails if `__DM_ONLY_SECRET_SHOULD_NOT_LEAK__` appears on anonymous paths.
- **Role matrix:** `role-matrix.test.ts` covers all five roles against pages, blocks, assets, and both worlds.
- **pnpm integration:** `pnpm test:security`, `pnpm test:authz`, `pnpm test:leaks` at repo root.
- **CI gate:** `.github/workflows/pr-check.yml` runs `pnpm test:security` via `pnpm ci:light:pr:gate` on code PRs; `.github/workflows/ci.yml` runs the full `pnpm quality` gate (including security, `pnpm secret:scan`, and `pnpm audit:prod`) on `main`.

## Extending the suite

1. Add a unique marker to `packages/security-tests/src/markers.ts`.
2. Seed content in `packages/security-tests/src/fixtures/security-fixture.ts`.
3. Extend `ROLE_MATRIX` in `role-matrix.test.ts` if visibility rules change.
4. Add the new data path to `scanPublicPortalForLeaks()` in `public-leak-scanner.ts`.
5. For new Studio API routes, add the file to `STUDIO_PROTECTED_API_ROUTES` in `route-authz.test.ts`.

## Related tests elsewhere

- `packages/database/src/visibility-security.test.ts` — hard portal visibility guarantees
- `packages/database/src/auth.test.ts` — auth integration
- `packages/auth/src/permissions.test.ts` — permission unit tests
- `apps/studio/src/lib/studio-api-auth.test.ts` — CSRF / bearer token guard
- `scripts/studio-route-auth.test.ts` — Studio API route auth inventory
- `scripts/security-leaks.test.ts` — leak-prevention coverage inventory
