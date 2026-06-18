# Security QA Matrix — Auth, Routes & Visibility

Manual and automated checks for UWE Studio and Portal authentication, route protection, setup wizard, and `player_visible` behavior.

**Last reviewed:** 2026-06-18  
**Automated baseline:** `pnpm test:security` (106 tests, all passing)

---

## How to use this matrix

| Column | Meaning |
|--------|---------|
| **Auto** | Covered by automated tests (`pnpm test:security`, `pnpm test:authz`, `pnpm test:leaks`) |
| **Manual** | Requires operator/DM verification in a running instance |
| **Status** | `pass` (verified), `gap` (not implemented), `n/a` (not applicable) |

Run automated checks before every release:

```bash
pnpm install --frozen-lockfile
pnpm --filter @uwe/database db:generate
pnpm test:security
pnpm test:authz
pnpm test:leaks
node --import tsx --test scripts/studio-route-auth.test.ts
```

---

## 1. First-run setup

| # | Test | Steps | Expected | Auto | Status |
|---|------|-------|----------|------|--------|
| 1.1 | Fresh DB without admin | Start with empty SQLite (`RUN_DB_SEED=false`, no seed marker) | No owner user in DB | ✓ `auth-setup.test.ts` | pass |
| 1.2 | `/setup` reachable | Open `http://localhost:3000/setup` | Setup form shown | Manual | pass |
| 1.3 | `GET /api/auth/setup` | `curl http://localhost:3000/api/auth/setup` | `{ "setupAvailable": true }` | Manual | pass |
| 1.4 | Create initial admin | Submit form with valid `UWE_SETUP_TOKEN`, name, email, password (≥8 chars) | Owner created, session cookie set, redirect to `/` | Manual | pass |
| 1.5 | `/setup` blocked after admin | Revisit `/setup` | "Setup abgeschlossen" message, link to login | ✓ `auth-setup.test.ts` | pass |
| 1.6 | `POST /api/auth/setup` blocked | Repeat POST with same token | HTTP 403 "Setup ist nicht mehr verfügbar." | ✓ `auth-setup.test.ts` | pass |
| 1.7 | Setup without token | POST without `UWE_SETUP_TOKEN` env | HTTP 503 "Setup ist nicht konfiguriert." | Manual | pass |
| 1.8 | Setup with wrong token | POST with invalid token | HTTP 403 "Ungültiges Setup-Token." | Manual | pass |

**Notes:** `UWE_SETUP_TOKEN` is required in production. `GET /api/auth/setup` reveals whether setup is still open (low severity; token still required for POST).

---

## 2. Login & logout

| # | Test | App | Steps | Expected | Auto | Status |
|---|------|-----|-------|----------|------|--------|
| 2.1 | Studio login (valid) | Studio | POST `/api/auth/login` with owner/dm credentials | Session cookie `uwe_session`, redirect to dashboard | Manual | pass |
| 2.2 | Studio login (invalid) | Studio | Wrong password | HTTP 401, generic "Ungültige Anmeldedaten." | Manual | pass |
| 2.3 | Studio login (player role) | Studio | Login as `player` role | HTTP 401 (no Studio access) | Manual | pass |
| 2.4 | Portal login (valid) | Portal | POST `/api/auth/login` | Session cookie, redirect to `/auth/worlds` | Manual | pass |
| 2.5 | Portal login (invalid) | Portal | Wrong password | HTTP 401, generic error, audit `login_failed` | Manual | pass |
| 2.6 | Rate limiting | Both | >8 failed logins in 5 min | HTTP 429 with `Retry-After` | ✓ rate-limit presets | pass |
| 2.7 | Studio logout | Studio | Visit `/logout` | Session deleted, redirect to `/login` | Manual | pass |
| 2.8 | Portal logout | Portal | Click logout button → POST `/api/auth/logout` | Session + preview cookies cleared | Manual | pass |
| 2.9 | Protected routes after logout | Both | Access `/` (Studio) or `/auth/worlds` (Portal) | Redirect to login | Manual | pass |
| 2.10 | 2FA login challenge | Both | Enable 2FA → login with password | Second step asks for TOTP code | ✓ auth-flow.integration.test.ts | pass |
| 2.11 | 2FA account setup UI | Both | `/account/security` (Studio), `/auth/account/security` (Portal) | Setup/activate/disable via UI | ✓ Playwright + Manual | pass |
| 2.12 | Studio login E2E | Studio | `pnpm test:e2e` | Login, invalid login, protected redirect | ✓ e2e/studio-auth.spec.ts | pass |

---

## 3. Route protection — Studio

| # | Route | Without login | With login (owner/dm) | Auto | Status |
|---|-------|---------------|----------------------|------|--------|
| 3.1 | `/` (landing) | Public landing page | Redirect `/login` when unauthenticated | ✓ middleware + layout | pass |
| 3.2 | `/studio` (dashboard) | Redirect `/login` | Allowed | ✓ middleware + layout | pass |
| 3.3 | `/worlds`, `/worlds/*` | Redirect `/login` | Allowed (role-gated) | ✓ studio-route-auth | pass |
| 3.4 | `/admin/*` | Redirect `/login` | Allowed (owner/admin) | ✓ | pass |
| 3.5 | `/settings`, `/backup`, `/brain` | Redirect `/login` | Allowed | ✓ | pass |
| 3.6 | `/login`, `/logout`, `/setup`, `/forgot-password`, `/reset-password` | Public (setup gated by availability) | Public | ✓ | pass |
| 3.6 | `/api/health` | Allowed | Allowed | ✓ | pass |
| 3.7 | `/api/auth/*` | Allowed (login/setup/logout) | Allowed | ✓ | pass |
| 3.8 | `/api/settings`, `/api/backup`, etc. | HTTP 401 | Allowed (session or bearer) | ✓ studio-route-auth (91 routes) | pass |
| 3.9 | Cross-origin API POST | HTTP 403 | HTTP 403 | ✓ route-authz.test.ts | pass |

**Dev bypass:** When `AUTH_REQUIRED=false` (default in development), Studio middleware allows unauthenticated access with synthetic `dev-bypass` user. Production defaults `AUTH_REQUIRED=true`.

---

## 4. Route protection — Portal

| # | Route | Without login (production) | With login | Auto | Status |
|---|-------|---------------------------|------------|------|--------|
| 4.1 | `/` (landing) | Public | Public | ✓ route-policy | pass |
| 4.2 | `/login` | Public | Public | ✓ | pass |
| 4.3 | `/worlds`, `/worlds/*` | Public (content-filtered) | Public + richer visibility | ✓ public-leak-scanner | pass |
| 4.4 | `/auth`, `/auth/*` | Redirect `/login` | Allowed | ✓ middleware | pass |
| 4.5 | `/share/*` | Public (token-scoped) | Public | ✓ share-link.test.ts | pass |
| 4.6 | `/api/health` | Public | Public | ✓ | pass |
| 4.7 | `/api/auth/login`, `/logout` | Public | Public | ✓ | pass |
| 4.8 | `/api/auth/change-password` | HTTP 401 | Allowed | ✓ | pass |
| 4.8a | `/api/auth/two-factor/*` (setup/manage) | HTTP 401 | Allowed (session) | ✓ route-policy | pass |
| 4.9 | Unknown API routes | HTTP 404 | HTTP 404 | ✓ deny-by-default | pass |
| 4.10 | `/worlds/*` with `AUTH_REQUIRED=true` | Redirect `/login` | Allowed | ✓ middleware.test.ts | pass |

---

## 5. Password reset

| # | Test | Expected | Auto | Status |
|---|------|----------|------|--------|
| 5.1 | Forgot password (existing email) | Generic success message, reset email sent (or dev log) | ✓ auth-password-reset.test.ts | pass |
| 5.2 | Forgot password (unknown email) | Same generic message (no enumeration) | ✓ auth-password-reset.test.ts | pass |
| 5.3 | Reset with valid token | Password changed, sessions invalidated | ✓ auth-password-reset.test.ts | pass |
| 5.4 | Reset with invalid token | HTTP 400, no password change | ✓ auth-password-reset.test.ts | pass |
| 5.5 | Reset with expired token | Rejected | Service layer only | pass |
| 5.6 | Old password fails after reset | Login rejected | ✓ auth-password-reset.test.ts | pass |
| 5.7 | New password works after reset | Login succeeds | ✓ auth-password-reset.test.ts | pass |
| 5.8 | Admin reset (`/api/admin/users/[id]/reset-password`) | Password changed, all sessions invalidated | ✓ password-security.test.ts | pass |
| 5.9 | Self-service change password | `/account/password` (Studio), `/auth/account/password` (Portal) | ✓ password-security.test.ts | pass |
| 5.10 | Reset tokens stored hashed | SHA-256 via `hashOpaqueToken` | ✓ opaque-token.ts | pass |
| 5.11 | Reset tokens expire (1h default) | `DEFAULT_RESET_TOKEN_TTL_MS` | Service layer | pass |
| 5.12 | Reset tokens single-use | Cleared after `resetPasswordWithToken` | Service layer | pass |

**Notes:** Self-service forgot/reset is wired for Studio and Portal (`/forgot-password`, `/reset-password`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`). Rate limit: `passwordReset` (5 / 15 min). SMTP optional; without SMTP, reset links are logged server-side in development only.

---

## 6. `player_visible` and `/worlds/*`

| # | Test | Expected | Auto | Status |
|---|------|----------|------|--------|
| 6.1 | `dm_only` page on `/worlds/*` | HTTP 404 | ✓ visibility-security.test.ts | pass |
| 6.2 | `dm_only` block in `player_visible` page | Block stripped from response | ✓ visibility-security.test.ts | pass |
| 6.3 | `player_visible` + `published` | Visible without login | ✓ public-leak-scanner | pass |
| 6.4 | `player_visible` + `draft` | Not visible | ✓ | pass |
| 6.5 | `public` visibility + guest mode off | Not visible to guests | ✓ role-matrix.test.ts | pass |
| 6.6 | Secret page titles (`dm_only`) | Not in search/graph/backlinks | ✓ visibility-leak.test.ts | pass |
| 6.7 | Authenticated player sees `specific_players` | Visible on `/auth/worlds/*` only | ✓ permissions.test.ts | pass |
| 6.8 | Studio `/worlds/*` | Requires Studio login (not public) | ✓ | pass |

**Design intent:** `player_visible` means "Portal ohne Login" — published content is world-readable by anyone who can reach the Portal URL. This is intentional; DM must understand the label in Studio.

---

## 7. Session & cookie security

| # | Check | Expected | Auto | Status |
|---|-------|----------|------|--------|
| 7.1 | Cookie name | `uwe_session` | ✓ | pass |
| 7.2 | httpOnly | `true` | ✓ runtime-config | pass |
| 7.3 | SameSite | `lax` (default) | ✓ | pass |
| 7.4 | Secure flag | `true` in production / HTTPS | ✓ | pass |
| 7.5 | Password hashing | scrypt v1 | ✓ password.test.ts | pass |
| 7.6 | No passwords in API responses | Safe user select excludes hash | ✓ password-security.test.ts | pass |
| 7.7 | No tokens in logs | Audit metadata redaction | ✓ | pass |
| 7.8 | Session tokens in DB | SHA-256 hashed at rest via `hashOpaqueToken` | ✓ auth.test.ts | pass |

---

## 8. API direct access (no session)

| # | Endpoint | Without session | Auto | Status |
|---|----------|-----------------|------|--------|
| 8.1 | `GET /api/backup` (Studio) | HTTP 401 | ✓ | pass |
| 8.2 | `GET /api/settings` (Studio) | HTTP 401 | ✓ | pass |
| 8.3 | `POST /api/import` (Studio) | HTTP 401 | ✓ | pass |
| 8.4 | `GET /api/admin/*` (Studio) | HTTP 401 | ✓ | pass |
| 8.5 | `GET /api/worlds/*/brain` (Studio) | HTTP 401 | ✓ | pass |
| 8.6 | Unknown Portal API | HTTP 404 | ✓ | pass |
| 8.7 | With `STUDIO_API_TOKEN` bearer | Allowed (scoped) | ✓ api-security.test.ts | pass |

---

## 9. ENV & secrets

| # | Check | Expected | Status |
|---|-------|----------|--------|
| 9.1 | `.env.example` has no real secrets | Placeholders only | pass |
| 9.2 | `pnpm secret:scan` | No hardcoded credentials | pass (CI) |
| 9.3 | `UWE_SETUP_TOKEN` documented | `.env.example`, PRODUCTION.md | pass |
| 9.4 | `AUTH_REQUIRED` default in production | `true` | pass |
| 9.5 | `RUN_DB_SEED=false` in production | Documented | pass |

---

## 10. Manual QA checklist (release)

Use this before exposing a new deployment:

1. [ ] Fresh install: create owner via `/setup` with `UWE_SETUP_TOKEN`
2. [ ] Confirm `/setup` blocked after owner exists
3. [ ] Studio: login → dashboard → logout → blocked again
4. [ ] Studio: `/forgot-password` → reset link → `/reset-password` → login
5. [ ] Portal: login → `/auth/worlds` → logout → blocked again
6. [ ] Portal `/worlds/*`: only published `player_visible`/`public` content visible
7. [ ] Studio `/admin/status`: no critical production warnings
8. [ ] Run `pnpm test:security` — 0 failures
9. [ ] Run Public Leak Scanner from Studio admin (0 critical findings)
10. [ ] Verify `dm_only` test page returns 404 on Portal
11. [ ] Cross-origin curl to Studio API returns 403

---

## Open risks & recommended next steps

| Priority | Risk | Mitigation |
|----------|------|------------|
| Low | Setup GET leaks availability | Acceptable if `UWE_SETUP_TOKEN` is secret |
| Low | Multi-instance rate limit bypass | Use reverse-proxy rate limits or `setRateLimitStore()` |

See also: [SECURITY.md](../SECURITY.md), [DEPLOYMENT_SECURITY.md](../DEPLOYMENT_SECURITY.md), [docs/security-testing.md](./security-testing.md).
