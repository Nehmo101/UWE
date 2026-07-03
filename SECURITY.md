# Security Policy

**Source of truth** for UWE self-hosting security. Operational details: [docs/auth-api-security.md](docs/auth-api-security.md), [docs/SECURITY_QA_MATRIX.md](docs/SECURITY_QA_MATRIX.md), [SECURITY_NOTES.md](SECURITY_NOTES.md).

## Further Security Docs

Detailed security documents live in [docs/security/](docs/security/):

- [docs/security/DEPLOYMENT_SECURITY.md](docs/security/DEPLOYMENT_SECURITY.md) — Cloudflare Tunnel/Access deployment guide
- [docs/security/SECURITY_REVIEW.md](docs/security/SECURITY_REVIEW.md) — historical security review (2026-06-16)
- [docs/security/dependency-notes.md](docs/security/dependency-notes.md) — dependency overrides and build-script allowlist
- [SECURITY_NOTES.md](SECURITY_NOTES.md) — AI privacy, RTX agent, cloud rules (stays in root; required by `scripts/integration-smoke.test.ts`)

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

UWE is a private/self-hosted project. If you discover a security issue:

1. **Do not** open a public issue with exploit details.
2. Contact the maintainers directly with a description of the issue, steps to reproduce, and potential impact.
3. Allow reasonable time for a fix before public disclosure.

---

## Authentication Model

UWE uses **native email/password authentication** with opaque database-backed session tokens — no external IdP required.

| App | Login | Session cookie | Notes |
|-----|-------|----------------|-------|
| **Studio** | `/login` | `uwe_session` (httpOnly, SameSite=Lax, Secure in production) | Roles `owner`, `admin`, `dm` only |
| **Portal** | `/login` | `uwe_session` | Roles `player`, `guest`, `readonly` for authenticated views |

**Layers on Studio (defence in depth):**

1. **Session login** — required for all Studio app routes and protected APIs when publicly exposed or `AUTH_REQUIRED=true`
2. **Cloudflare Access / reverse-proxy auth** — recommended outer gate when Studio is internet-facing
3. **`STUDIO_API_TOKEN` or scoped API tokens** — for non-browser clients and extra API hardening
4. **CSRF protection** — cross-origin browser requests to Studio APIs are rejected

**Dev bypass:** In development (`NODE_ENV` ≠ `production`), Studio middleware may allow unauthenticated access with a synthetic `dev-bypass` user unless `STUDIO_ROUTE_POLICY_ENFORCE=true`.

---

## Roles

| Role | Studio | Admin (`/admin/*`) | Portal |
|------|--------|-------------------|--------|
| `owner` | ✓ | ✓ | session-based content |
| `admin` | ✓ | ✓ | session-based content |
| `dm` | ✓ | ✗ | session-based content |
| `player` | ✗ (login rejected) | ✗ | own visibility only |
| `readonly` / `guest` | ✗ | ✗ | public/guest wiki only |

Player accounts **cannot** access Studio. DM accounts **cannot** access admin APIs without `owner`/`admin` role.

---

## Route Policies

Central policy: `packages/auth/src/security/route-policy.ts`. Middleware: `evaluateStudioMiddleware` / `evaluatePortalMiddleware`.

**Deny-by-default:** Unknown API routes return 404 (not 401) to avoid route enumeration.

### Portal — public without login

Production is **login-first**: only auth entrypoints and health/maintenance probes stay public.

- `/login`, `/logout`, `/setup`, `/forgot-password`, `/reset-password`
- `/api/health`, `/api/health/public`, `/api/maintenance/status`, `/api/maintenance/evaluate`
- `/api/auth/login`, `/api/auth/logout`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/two-factor/verify`

### Portal — session required

All content routes redirect to `/login` without a session in production:

- `/`, `/portal`, `/worlds/*`, `/players/*`, `/share/*`, `/auth/*`, `/public-assets/*`
- `/api/auth/change-password`, `/api/auth/preview`, `/api/share/*`, `/api/assets/*/file`, `/api/worlds/*/graph`

### Studio — public

- `/login`, `/logout`, `/setup`, `/forgot-password`, `/reset-password`
- `/api/health`, `/api/health/public`, `/api/maintenance/status`, `/api/maintenance/evaluate`
- `/api/auth/login|logout|setup|forgot-password|reset-password|two-factor/verify`
- `/api/spotify/callback`, `/api/agent-jobs/callback`, `/api/connectors/*` (eigene Token-Auth im Handler)

### Studio — protected (session or bearer)

All other Studio app and API routes, including `/`, `/worlds/*`, `/admin/*`, `/api/backup`, `/api/settings`, `/api/brain`, `/api/export`, `/api/mail`, `/api/jobs`, `/api/calendar`, `/api/dnd-api`, `/api/image-studio`, `/api/inference`.

Full matrix: [docs/SECURITY_QA_MATRIX.md](docs/SECURITY_QA_MATRIX.md).

---

## DM-Only & Portal Leak Protection

- **`dm_only`** pages, blocks, assets, soundboard buttons, session fields, and secret page *titles* are filtered server-side for Portal, search, graph, backlinks, related pages, and static export
- **`player_visible`** (Studio label: *"Portal sichtbar"*) and **`public`** content on **published** pages is readable by anyone who can reach `/worlds/*` (no login required) — this is intentional
- Hard regression tests: `packages/database/src/visibility-security.test.ts`, `pnpm test:leaks`
- Studio **World Inspector** audits portal-visible content and offers one-click fixes
- **Public Leak Scanner** (`/admin/status`) flags accidental DM-only markers on public routes

---

## Session Handling

- Opaque tokens stored hashed in SQLite — **not** derived from `AUTH_SECRET`
- Cookie name: `uwe_session` (from `@uwe/auth`)
- Production: `SESSION_COOKIE_SECURE=true`, `SESSION_COOKIE_SAMESITE=lax`
- Logout clears session server-side and expires cookie
- Password reset invalidates **all** sessions for the affected user
- `AUTH_SECRET` encrypts Spotify OAuth tokens per world and other at-rest secrets — keep stable after Spotify connect

---

## Password Reset

| Step | Route | Notes |
|------|-------|-------|
| Request | `POST /api/auth/forgot-password` | Neutral response (no account enumeration) |
| Reset | `POST /api/auth/reset-password` | Opaque token, 1h TTL, hashed at rest |
| UI | `/forgot-password`, `/reset-password` | Studio + Portal |
| Admin | `POST /api/admin/users/[id]/reset-password` | Owner/admin only |

With SMTP configured (`MAIL_ENABLED=true`, `SMTP_HOST`), reset links are emailed. Without SMTP in dev, the link is logged once server-side — never in API responses.

---

## Setup Protection

First-run owner bootstrap via `/setup`:

| Control | Behaviour |
|---------|-----------|
| `UWE_SETUP_TOKEN` | Required env secret for `POST /api/auth/setup` |
| `RUN_DB_SEED=false` | No demo users in production |
| Availability | Disabled automatically once an owner exists |
| Rate limit | `setup` preset: 20 requests/min |

Production flow: set `UWE_SETUP_TOKEN`, open Studio `/setup`, create owner, then remove or rotate the token.

---

## Rate Limits

In-memory per-process limiter (`@uwe/security`). **Not sufficient alone** for multi-instance deployments — add proxy-level limits.

| Preset | Limit |
|--------|-------|
| `login` | 8 / 5 min |
| `passwordReset` | 5 / 15 min |
| `setup` | 20 / min |
| `ai` | 30 / min |
| `import` | 10 / min |
| `upload` | 20 / min |
| `search` | 60 / min |

---

## Cloud AI Context Boundaries

Enforced server-side by the AI router / privacy guard (`packages/ai-brain`):

| Context | Cloud allowed? | Notes |
|---------|----------------|-------|
| General chat (prompt only) | Yes | Always |
| Brain / world knowledge | **Configurable** | Default: CLOUD_ALLOWED (RTX preferred, cloud fallback OK) |
| Current object (page, NPC, …) | **Configurable** | Same as brain; admin can set CLOUD_FORBIDDEN |
| Object + brain | **Configurable** | Same as brain |
| Auto mode + DnD context + RTX offline | **Allowed** → cloud fallback | When gateway policy is CLOUD_ALLOWED |
| Personal Life Brain (`personal_brain`) | **Never** — hard rule | Permanently local-only, cannot be configured |

**Hard rules (non-negotiable, code-enforced):**
- `personal_brain` (Life Brain) never goes to cloud, regardless of any config.
- DM-only content is always stripped before cloud routing.
- datenschutzMode=true blocks all campaign data from cloud.

Admin gateway policy (`DEFAULT_PRIVACY_RULES.dnd_world = CLOUD_ALLOWED`) allows DnD world context to reach cloud providers when RTX is offline. This is intentional and owner-approved behaviour (W0 Atlas policy).

Details: [SECURITY_NOTES.md](SECURITY_NOTES.md), [docs/ai-privacy-and-cloud-fallback.md](docs/ai-privacy-and-cloud-fallback.md).

---

## RTX / AI Worker Exposure

**Never expose the RTX Connector helper endpoints, RTX worker, Ollama, or LM Studio to the public internet.**

- No Cloudflare Tunnel or port-forward to the RTX machine or local inference endpoints
- `RTX_BASE_URL` must point to a private LAN IP or `localhost` when a direct RTX worker is used
- `AI_INFERENCE_ALLOW_PUBLIC_URL=false` (default) blocks public RTX URLs
- The RTX Host Connector connects outbound to UWE and stores no UWE source-of-truth data

---

## Built-in Protections

- **Visibility filtering** — see DM-only section above
- **Share links** — each token is scoped strictly to its own target; expiry, enable/disable, and scrypt-hashed passwords are enforced on every access
- **Rate limiting** — login, share-password, and setup attempts are rate limited per IP (in-memory, per process; use reverse-proxy limits or `setRateLimitStore()` for multi-instance deployments)
- **Settings API validation** — partial settings updates are validated at runtime; unknown keys and invalid enum/path values are rejected with HTTP 400
- **CSRF protection** — sensitive Studio API routes reject cross-origin browser requests
- **Backups** — password hashes, session tokens, and API keys stripped; Zip Slip protection; optional AES-256-GCM encryption (`UWE_BACKUP_ENCRYPTION_KEY`); role-based access (OWNER/ADMIN create, OWNER-only restore)
- **AI keys** — environment only; never in database or client responses
- **Webhook SSRF protection** — blocks private/localhost targets
- **Spotify playback** — OAuth and Web API playback control are Studio-only; the Portal may display Spotify buttons but does not trigger playback
- **File uploads** — stored on disk under `UPLOADS_DIR`; ensure filesystem permissions are restricted
- **Static export** — only portal-visible content is exported; run export audit before publishing externally

---

## Known Residual Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Studio exposed without layered auth | Critical | Session login + Cloudflare Access + `STUDIO_API_TOKEN` |
| Accidental `player_visible` publish | High | Inspector + Leak Scanner + DM training on visibility labels |
| Cloudflare Access misconfiguration | High | Manual policy review per [docs/cloudflare-access.md](docs/cloudflare-access.md) |
| DM-only leak via code regression | Critical | `pnpm test:leaks`, `visibility-security.test.ts` in CI |
| Multi-instance rate limit bypass | Medium | Proxy-level rate limits or `setRateLimitStore()` |
| SQLite concurrent writes | Medium | Single-writer; backup during low activity |
| `AUTH_SECRET` rotation | High | Invalidates Spotify tokens, share passwords — reconnect after rotate |
| Physical host compromise | High | OS hardening, disk encryption |
| 2FA not yet active | Medium | Schema ready (`TwoFactorSecret`); login integration planned |
| Backup completeness gaps | Low | PageTemplates, some metadata — see [docs/BACKUP.md](docs/BACKUP.md) |
| Supply chain (npm) | Medium | `pnpm audit:prod`, frozen lockfile in CI |

**Additional considerations:**

- **`player_visible` means "no login required"** — published pages/blocks/assets/soundboard buttons with visibility `player_visible` (or `public`) are readable by anyone who can reach the Portal's `/worlds/*` routes. This is by design; the Studio UI labels this visibility as "Portal sichtbar" (für Spieler freigegeben) to make the consequence explicit. `dm_only` content is never served on those routes
- **Portal sessions** — opaque database-backed tokens (httpOnly, SameSite=Lax, Secure in production); token hashes stored at rest via SHA-256; they are not derived from `AUTH_SECRET`
- **Share links** — public URLs grant read access to specific content; review active links regularly

---

## Production Hardening Checklist

Before exposing UWE to the internet:

- [ ] Strong unique `AUTH_SECRET` / `SESSION_SECRET` in `.env` (never commit `.env`)
- [ ] `RUN_DB_SEED=false` — no demo worlds on live deployment
- [ ] First-run: `UWE_SETUP_TOKEN` → `/setup` → owner account → rotate/remove token
- [ ] HTTPS via reverse proxy or Cloudflare Tunnel (`TRUST_PROXY=true`)
- [ ] **Studio:** Cloudflare Access or VPN **plus** session login; set `STUDIO_API_TOKEN` for API hardening
- [ ] **Portal:** review `AUTH_REQUIRED`, `PLAYER_PREVIEW_PUBLIC`, share-link settings
- [ ] `SESSION_COOKIE_SECURE=true` behind HTTPS
- [ ] RTX Connector and local inference endpoints on private LAN only — never in tunnel config
- [ ] Back up `./data/` and Docker volume `uwe-database` before updates
- [ ] AI/cloud API keys only in `.env`
- [ ] Multi-instance: rate limiting at reverse proxy or `setRateLimitStore()` (Redis/Upstash)
- [ ] Post-deploy: `pnpm test:security`, Public Leak Scanner at `/admin/status`

Deployment guides: [docs/security/DEPLOYMENT_SECURITY.md](docs/security/DEPLOYMENT_SECURITY.md), [docs/deployment-hardening.md](docs/deployment-hardening.md), [docs/PRODUCTION.md](docs/PRODUCTION.md).

The Studio dashboard and `GET /api/health` surface warnings for common misconfigurations (weak/missing `AUTH_SECRET`, `RUN_DB_SEED` not `false`, missing `STUDIO_API_TOKEN`, active public sharing).

---

## Dependencies

Security updates for Node.js dependencies are applied via `pnpm update` and regular releases.
Run `pnpm audit` periodically in development environments.
