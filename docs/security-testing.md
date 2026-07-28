# Security Testing

Automated security tests for UWE ensure that world content never crosses the
world boundary and that sensitive Studio API routes stay protected.

## Quick start

```bash
pnpm install
pnpm --filter @uwe/database db:generate

# Full security suite (authz + leak scanner)
pnpm test:security

# Access matrix + route guards only
pnpm test:authz

# Coverage inventory only (are the guard tests still there?)
pnpm test:leaks
```

Pull requests with code changes run `pnpm test:security` as part of `pnpm ci:light:pr:gate` (see `.github/workflows/pr-check.yml`). Docs-only PRs skip the heavy gate.

## What is tested

| Suite | Command | Scope |
|-------|---------|--------|
| **Access matrix** | part of `test:authz` | Anonymous, world member, and Studio access to pages, blocks, assets, both worlds |
| **Route authorization** | part of `test:authz` | Studio `/admin`, `/api/admin/*`, `/api/import/*`, `/api/brain/*`, `/api/ai/*`, search, Portal `/auth/worlds/*` |
| **Studio route inventory** | part of `test:authz` | Every Studio API route must call `requireStudioApiAuth`, `requireRestoreOwnerAuth`, or be explicitly allowlisted |
| **Portal route inventory** | part of `test:authz` | Every Portal API route must call a recognized guard |
| **Treasury authorization** | part of `test:authz` | Player-safe item filtering and move permissions |
| **Coverage inventory** | `test:leaks` | Ensures the guard tests themselves stay present

Package: `@uwe/security-tests` (`packages/security-tests/`).

## Access mapping

There is no role enum. The suite exercises the three shapes the model allows:

| Test actor | UWE implementation | Sees |
|-----------|-------------------|--------|
| **anonymous** | No session | Nothing — every route needs a session |
| **world member** | `portal` checkbox + `WorldMembership` | Everything in that world, nothing in others |
| **Studio user** | `studio` checkbox | Every world, with or without an assignment |

`isOwner` is tested separately as the gate on `/admin/*`, restore, and host control.

## Test fixtures

Each run seeds an isolated SQLite database with labeled content:

Content carries marker strings so a cross-world read is visible in any response
body. Two worlds are seeded:

- **`sec-public-world`** — the test member is assigned here
- **`sec-private-world`** — the test member is **not** assigned; anything from
  this world showing up in their responses is the regression the suite exists for

Markers live in `packages/security-tests/src/markers.ts`.

## Route coverage notes

| Requested path | UWE location |
|----------------|--------------|
| `/studio` | Studio app root (`http://localhost:3000/`) — no `/studio` prefix |
| `/admin` | `apps/studio/app/admin/*` |
| `/api/search/*` | `apps/studio/app/search/page.tsx` + `apps/studio/app/api/command/search/route.ts` |
| `/players/*` | Not implemented — players managed via `WorldMembership` and `POST /api/mail/recipients` (`sync_players`) |

Studio API routes require session login (or bearer token) plus CSRF protection; optional `STUDIO_API_TOKEN` for extra hardening. Portal `/auth/worlds/*` requires a session and a world assignment — there is no anonymous tree.

## Acceptance criteria

- **Cross-world read:** `role-matrix.test.ts` and `authz-integration.test.ts` fail if a member of one world reads the other.
- **Anonymous read:** every actor without a session must get nothing.
- **pnpm integration:** `pnpm test:security`, `pnpm test:authz`, `pnpm test:leaks` at repo root.
- **CI gate:** `.github/workflows/pr-check.yml` runs `pnpm test:security` via `pnpm ci:light:pr:gate` on code PRs; `.github/workflows/ci.yml` runs the full `pnpm quality` gate (including security, `pnpm secret:scan`, and `pnpm audit:prod`) on `main`.

## Extending the suite

1. Add a unique marker to `packages/security-tests/src/markers.ts`.
2. Seed content in `packages/security-tests/src/fixtures/security-fixture.ts`.
3. Extend the matrix in `role-matrix.test.ts` if the access rules change.
4. For new Studio API routes, add the file to `STUDIO_PROTECTED_API_ROUTES` in `route-authz.test.ts`.

## Related tests elsewhere

- `packages/database/src/authz-integration.test.ts` — hard world-boundary guarantees
- `apps/portal/src/lib/world-access.test.ts` — the Portal world gate
- `packages/database/src/auth.test.ts` — auth integration
- `packages/auth/src/permissions.test.ts` — permission unit tests
- `apps/studio/src/lib/studio-api-auth.test.ts` — CSRF / bearer token guard
- `scripts/studio-route-auth.test.ts` — Studio API route auth inventory
- `scripts/security-leaks.test.ts` — leak-prevention coverage inventory
