# UWE Auth / API / Security

Native authentication and API security for UWE Studio and Portal — inspired by operational patterns from [Odysseus](https://github.com/pewdiepie-archdaemon/odysseus), implemented directly in UWE without a sidecar.

## Overview

| Layer | Package / App | Responsibility |
|-------|---------------|----------------|
| Roles & gates | `@uwe/auth` | Global roles, admin gate, API token scopes, webhook signatures |
| Persistence | `@uwe/database` | `ApiToken`, `WebhookEndpoint`, `AuditLog`, `SecurityWarning`, 2FA prep models |
| Request guards | `@uwe/security` | CSRF, rate limits, `requireAdminApiAuth`, bearer resolution hooks |
| Admin UI | `apps/studio` | Token management, webhooks, audit log, security warnings |

## Roles

| Role | Studio | Admin (`/admin/*`) | Player Portal |
|------|--------|-------------------|---------------|
| `owner` | ✓ | ✓ | session-based content |
| `admin` | ✓ | ✓ | session-based content |
| `dm` | ✓ | ✗ | session-based content |
| `player` | ✗ | ✗ | own visibility only |
| `readonly` / `guest` | ✗ | ✗ | public/guest wiki only |

**Player Portal stays separated from Studio/Admin** — portal middleware enforces session + content visibility; studio admin APIs require `ADMIN_ACCESS_ROLES` or scoped API tokens.

## API Tokens

### Properties

- Prefix: `uwe_` + 64 hex chars (generated via `generateApiTokenValue()`)
- **Only SHA-256 hashes stored** (`token_hash`) — plaintext shown once at creation
- Display prefix (`token_prefix`) for identification in UI
- Narrow scopes via `ApiTokenScope` enum
- Revocation, rotation, usage log (hashed IP only)
- Audit events: `api_token_created`, `api_token_revoked`, `api_token_rotated`

### Scopes

| Scope | Grants access to |
|-------|------------------|
| `health_read` | Health endpoints |
| `worlds_read` | World read APIs |
| `export_read` | Static export |
| `webhooks_manage` | Webhook CRUD + test delivery |
| `ai_invoke` | AI / Brain routes |
| `mail_read` / `mail_send` | Mail center |
| `settings_read` / `settings_write` | System settings |
| `admin_read` / `admin_write` | Admin status, audit log, security |
| `backup_read` / `backup_write` | Backup / restore |

Admin scopes (`admin_*`) require the token owner to have `owner` or `admin` role.

### Bearer Auth

```http
Authorization: Bearer uwe_<secret>
```

Resolution order in Studio:

1. DB API token (`uwe_` format) → scoped auth
2. `STUDIO_API_TOKEN` env (legacy shared token)
3. Session cookie (same-origin browser)

## Admin Gate

`evaluateAdminGate()` / `requireAdminApiAuth()` enforce:

- **Session**: user must be `owner` or `admin`
- **API token**: must include required scopes
- **Player block**: `player`, `guest`, `readonly` always denied on admin APIs

## Webhooks

Outbound HTTP POST with:

- `X-UWE-Signature` — HMAC-SHA256 over `{timestamp}.{body}`
- `X-UWE-Timestamp` — replay protection (5 min window)
- `X-UWE-Event` — event name

Signing secrets are **encrypted at rest** (`secret_encrypted`), not hashed (HMAC requires recovery).

SSRF protection via `assertFetchUrlAllowed()` — blocks private/localhost targets.

### Events

`backup.created`, `import.completed`, `import.failed`, `ai.run.completed`, `content.published`, `webhook.test`

## Rate Limiting

Single-instance in-memory limiter (`RATE_LIMITER_MODE` in `@uwe/security`).

| Preset | Limit |
|--------|-------|
| `login` | 8 / 5 min |
| `passwordReset` | 5 / 15 min |
| `setup` | 20 / min |
| `ai` | 30 / min |
| `import` | 10 / min |
| `upload` | 20 / min |
| `search` | 60 / min |

**Multi-instance**: inject a distributed store via `setRateLimitStore()` or enforce limits at the reverse proxy (Cloudflare, nginx). Documented in `SECURITY.md` and `docs/PRODUCTION.md`.

## Audit Log

Append-only `AuditLog` with hashed IP/UA, metadata redaction (`redactAuditMetadata`). New actions include token and webhook lifecycle events.

## Security Warnings

Runtime warnings from `buildSecurityWarnings()` are synced to `security_warnings` table. Dismissal tracked per code with audit entry.

Public exposure checks surface when `PUBLIC_BASE_URL` / `CLOUDFLARE_TUNNEL` indicate internet-facing deployment without `STUDIO_API_TOKEN` or Cloudflare Access.

## Secret Masking

- API responses never include full tokens or webhook secrets after creation
- `maskSecretValue()` / `maskTokenForDisplay()` for UI
- Audit metadata strips `token`, `password`, `authorization`, prompt bodies

## 2FA (TOTP)

Fully active in the login flow: `performLoginFlow` issues a `challengeToken`
when the account has 2FA enabled, `completeTwoFactorLogin` verifies the TOTP
code (rate-limited per IP + challenge). Shared route orchestration lives in
`packages/auth/src/two-factor-routes.ts`; Studio wires it under
`/api/auth/two-factor/*`. Models: `TwoFactorSecret`, `TwoFactorChallenge`.

## Password reset (self-service)

Studio and Portal expose matching flows:

| Step | Studio | Portal |
|------|--------|--------|
| Request reset | `POST /api/auth/forgot-password` | same |
| Set new password | `POST /api/auth/reset-password` | same |
| UI | `/forgot-password`, `/reset-password` | same |

- Always returns a neutral success message on forgot-password (no account enumeration)
- Reset tokens are opaque, hashed at rest, 1-hour TTL; all sessions invalidated on success
- When SMTP is configured (`SMTP_HOST`, `MAIL_ENABLED=true`), reset links are emailed; in development without SMTP, the server logs the link once (never in API responses)
- Admin-initiated reset remains at `POST /api/admin/users/[id]/reset-password`
- The reset form sends `resetToken` (from the `token` query parameter in the emailed link)

### Auth UI (shared)

Public auth pages use the dark UWE shell from `@uwe/shared-ui`:

| Component | Location | Used on |
|-----------|----------|---------|
| `AuthPageLayout` | `packages/shared-ui/src/auth/AuthPageLayout.tsx` | Login, forgot/reset password, setup, account (compact) |
| `AuthBrandingPanel` | `packages/shared-ui/src/auth/AuthBrandingPanel.tsx` | Branding column with UWE logo, feature hints, self-hosted note |
| `AuthCard` | same as layout | Form card shell |
| `LoginForm`, `ForgotPasswordForm`, `ResetPasswordForm` | `packages/shared-ui/src/auth/` | Both apps |
| `UweLandingPage` | `packages/shared-ui/src/auth/UweLandingPage.tsx` | `/` start page (Studio & Portal) |

Styles: `packages/shared-ui/src/uwe.css` (`.uwe-auth-shell`, `.uwe-auth-card`, …) plus app-specific `.studio-auth-*` / `.auth-*` in each app's `globals.css`.

**Not yet styled with the auth shell:** Portal logged-in account pages (`/auth/account/*`) keep `AuthHeader` navigation; invite acceptance has no public page yet (backend only).

## Localhost / LAN Safety

- Studio APIs deny cross-origin browser requests (CSRF)
- Without `STUDIO_API_TOKEN`, Studio trusts same-origin/LAN by default
- `isPublicExposureConfigured()` triggers stricter auth when publicly exposed
- Webhook delivery blocks RFC1918, loopback, `.local`, `.internal` hosts

## Admin UI

| Path | Purpose |
|------|---------|
| `/admin/api-tokens` | Create, revoke, scope selection, last-used |
| `/admin/webhooks` | Endpoint management, test delivery |
| `/admin/audit-log` | Filterable security audit |
| `/admin/security` | Dashboard + public exposure warnings |

## Tests

```bash
pnpm --filter @uwe/auth test
pnpm --filter @uwe/database test
pnpm --filter @uwe/security test
pnpm test:security
```

Key assertions:

- Tokens stored hashed only
- Scope enforcement on admin APIs
- Admin gate blocks players and DMs
- Webhook signature verification
- Rate limit presets
- No secrets in security dashboard JSON

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `AUTH_SECRET` / `SESSION_SECRET` | Session + encryption + token hash salt |
| `API_TOKEN_HASH_SALT` | Optional dedicated API token hash salt |
| `STUDIO_API_TOKEN` | Legacy shared bearer (prefer per-user tokens) |
| `RESTORE_OWNER_TOKEN` | Extra guard for backup restore |
| `UWE_SETUP_TOKEN` | One-time owner bootstrap via `/setup` |
| `PUBLIC_BASE_URL` | Public exposure detection |
| `SESSION_INACTIVITY_TIMEOUT_MINUTES` | Idle auto-logout fallback (minutes); only used when `settings.auth.sessionInactivityTimeoutMinutes` is `0` — see `SECURITY.md` § Inactivity auto-logout |

## Migration

```bash
pnpm --filter @uwe/database db:generate
pnpm --filter @uwe/database db:migrate
```

Migration: `20260618120000_auth_api_security`
