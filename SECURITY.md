# Security Policy

**Source of truth** for UWE self-hosting security. Operational details: [docs/auth-api-security.md](docs/auth-api-security.md), [docs/SECURITY_QA_MATRIX.md](docs/SECURITY_QA_MATRIX.md), [SECURITY_NOTES.md](SECURITY_NOTES.md).

## Further Security Docs

Detailed security documents live in [docs/security/](docs/security/):

- [docs/security/DEPLOYMENT_SECURITY.md](docs/security/DEPLOYMENT_SECURITY.md) — Cloudflare Tunnel/Access deployment guide
- [docs/security/SECURITY_REVIEW.md](docs/security/SECURITY_REVIEW.md) — historical security review (2026-06-16)
- [docs/security/dependency-notes.md](docs/security/dependency-notes.md) — dependency overrides and build-script allowlist
- [SECURITY_NOTES.md](SECURITY_NOTES.md) — AI privacy, Maschinenraum agent, cloud rules (stays in root; required by `scripts/integration-smoke.test.ts`)

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

UWE is a self-hosted project maintained in the open. If you discover a security
issue, please report it **privately**:

**→ [Report a vulnerability](https://github.com/Nehmo101/UWE/security/advisories/new)**
(GitHub → Security → Advisories → Report a vulnerability)

This channel is private and reaches the maintainers only. Please include:

- a description of the issue and its potential impact,
- steps to reproduce, ideally against a fresh `pnpm db:seed` checkout,
- the affected surface (Studio / Portal / Brain / Family / Landing / Command Center)
  and the commit or version you tested.

**Please do not** open a public issue with exploit details, and allow reasonable
time for a fix before public disclosure.

### What to expect

| | |
|---|---|
| First response | within 7 days |
| Assessment and plan | within 14 days |
| Fix or mitigation | depends on severity; coordinated with the reporter |

UWE is a hobby project maintained by a single person in their spare time — there
is no paid security team and no bug bounty. Reports are taken seriously
regardless.

### Especially interesting

Findings that break one of UWE's core invariants carry the most weight:

- A `:::dm` section reaching the **Portal** or anyone without the Studio checkbox
- `owner_private_local` content leaving the **host**
- Bypassing the four-checkbox area access (`packages/auth/src/area-access.ts`)
  or the world assignment (`packages/auth/src/permissions.ts`)
- Session, CSRF, or API-token weaknesses
- Anything that turns a self-hosted instance into an open relay or a path into
  the host's LAN

### Out of scope

- Findings that require an already-compromised host or an existing `owner` session
- The seeded demo credentials (`dm@uwe.local` / `uwe-dev`) — the demo seed
  refuses to run with `NODE_ENV=production`, and the credential hints render
  only in development
- Missing hardening on a deliberately unauthenticated deployment
  (`AUTH_REQUIRED=false` is an opt-out the operator chooses)
- Automated scanner output without a demonstrated impact

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

## Access

The role enum is gone (Notiz Lasse, 2026-07-26). Access is four checkboxes per
e-mail address, set by the owner in the Command Center — there is no
self-registration and no anonymous guest.

| Checkbox | Grants |
|---|---|
| `portal` | the Spieler-Portal, for every world the address is assigned to |
| `studio` | the DM workspace, and with it every world |
| `brain` | the owner-private Brain product |
| `family` | the Family product |

Plus one flag that is not an area: **`isOwner`** — operations, restore, host
control, `/admin/*`. The first account created at setup gets the owner flag and
all four checkboxes.

Two axes, and that is all: *the checkbox says which app, the world assignment
says which world.*

- `packages/auth/src/area-access.ts` — the checkboxes and the Studio route gate
- `packages/auth/src/permissions.ts` — `canViewWorldContent`, the single content rule
- Command Center → **Zugänge** — where the checkboxes are set

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
- `/api/spotify/callback`, `/api/connectors/*` (eigene Token-Auth im Handler)

### Studio — protected (session or bearer)

All other Studio app and API routes, including `/`, `/worlds/*`, `/admin/*`, `/api/backup`, `/api/settings`, `/api/brain`, `/api/export`, `/api/mail`, `/api/jobs`, `/api/calendar`, `/api/dnd-api`, `/api/image-studio`, `/api/inference`.

Full matrix: [docs/SECURITY_QA_MATRIX.md](docs/SECURITY_QA_MATRIX.md).

---

## World Boundary

Per-item visibility is gone. There is exactly one content rule left:

> **Whoever is assigned to a world sees everything in it — except a DM section
> inside the wiki text.**

No `dm_only` flag on pages, blocks or assets, no `player_visible`, no draft
state, no per-page grant, no share link, no guest mode. The one exception is
authored inside the text itself:

```
:::dm
Only readers with the Studio checkbox (and the owner) ever receive this.
:::
```

It is cut out server-side before rendering — not hidden client-side — at
`filterBlocksForViewer`, `renderBlockContentForViewer`, `searchForAuthContext`
and `sanitizeForPlayer`. The rule is `canReadDmSections`
(`packages/auth/src/permissions.ts`); world assignment alone does **not**
qualify, and previewing as a player drops it. Details:
[docs/engineering/access-model.md](docs/engineering/access-model.md).

What still has to hold:

- The world boundary itself — `scopeFromAccessContext` only carries a membership
  over when it belongs to *that* world. Without it, a member of world A could
  read world B.
- An anonymous visitor gets nothing at all; every route needs a session.
- A DM section never reaches a reader without the Studio checkbox — not in the
  page, not in the rendered HTML, not in a search hit or its snippet.
- Hard regression tests: `packages/auth/src/security/authz.test.ts`,
  `packages/auth/src/dm-section.test.ts`,
  `packages/database/src/dm-section-access.test.ts`,
  `apps/portal/src/lib/world-access.test.ts`, `pnpm test:security`
- Studio **World Inspector** still audits content quality (broken wikilinks,
  unassigned pages) — its exposure half is gone with visibility.

---

## Session Handling

- Opaque tokens stored hashed in SQLite — **not** derived from `AUTH_SECRET`
- Cookie name: `uwe_session` (from `@uwe/auth`)
- Production: `SESSION_COOKIE_SECURE=true`, `SESSION_COOKIE_SAMESITE=lax`
- Logout clears session server-side and expires cookie
- Password reset invalidates **all** sessions for the affected user
- `AUTH_SECRET` encrypts Spotify OAuth tokens per world and other at-rest secrets — keep stable after Spotify connect

### Inactivity auto-logout

- `Session.lastActiveAt` (`packages/database/prisma/schema.prisma`) tracks the last request that touched the session, independent of the absolute `expiresAt` TTL (14 days).
- `getSessionByToken()` (`packages/database/src/auth.ts`) deletes the session server-side once `now - lastActiveAt` exceeds the configured inactivity timeout — a real sliding-window idle logout, not just a fixed cookie `maxAge`. Active sessions are "touched" on each request, throttled to at most once per minute (`SESSION_ACTIVITY_TOUCH_THROTTLE_MS`).
- `SessionIdleGuard` (`packages/shared-ui/src/auth/SessionIdleGuard.tsx`) mirrors this client-side: it watches for user interaction (mouse/keyboard/scroll/touch/tab visibility), redirects to `/login?reason=idle` via `/api/auth/logout` when the browser goes idle, and periodically pings `/api/auth/session/touch` to keep the session alive while the user is active. Mounted in both Studio and Portal shells.
- **Configurable:** Studio → **Settings → Privacy** (`/settings?tab=privacy`, "Session & Abmeldung") sets `settings.auth.sessionInactivityTimeoutMinutes` (default 30, `0` = disabled, max 1440). Falls back to the `SESSION_INACTIVITY_TIMEOUT_MINUTES` env var only when the DB setting is `0`.

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
| Brain / world knowledge | **Configurable** | Default: CLOUD_ALLOWED (Maschinenraum preferred, cloud fallback OK) |
| Current object (page, NPC, …) | **Configurable** | Same as brain; admin can set CLOUD_FORBIDDEN |
| Object + brain | **Configurable** | Same as brain |
| Auto mode + DnD context + Maschinenraum offline | **Allowed** → cloud fallback | When gateway policy is CLOUD_ALLOWED |
| Personal Life Brain (`personal_brain`) | **Never** — hard rule | Permanently local-only, cannot be configured |

**Hard rules (non-negotiable, code-enforced):**
- `personal_brain` (Life Brain) never goes to cloud, regardless of any config.
- DM-only content is always stripped before cloud routing.
- datenschutzMode=true blocks all campaign data from cloud.

Admin gateway policy (`DEFAULT_PRIVACY_RULES.dnd_world = CLOUD_ALLOWED`) allows DnD world context to reach cloud providers when Maschinenraum is offline. This is intentional and owner-approved behaviour (W0 Atlas policy).

Details: [SECURITY_NOTES.md](SECURITY_NOTES.md), [docs/ai-privacy-and-cloud-fallback.md](docs/ai-privacy-and-cloud-fallback.md).
Architekturentscheidungen: [ADR 005 — Session-Audiences](docs/adr/005-session-audiences.md),
[ADR 006 — KI-/Privacy-Policy](docs/adr/006-ai-privacy-policy.md) und
[ADR 007 — Deployment/Exposure](docs/adr/007-deployment-exposure.md). Diese ADRs
beschreiben Zielzustände; Cookie- und Runtime-Verhalten bleiben in der aktuellen
Foundation-Welle unverändert.

---

## Maschinenraum / AI Worker Exposure

**Never expose the Maschinenraum helper endpoints, Maschinenraum worker, Ollama, or LM Studio to the public internet.**

- No Cloudflare Tunnel or port-forward to the Maschinenraum machine or local inference endpoints
- `ENGINE_BASE_URL` must point to a private LAN IP or `localhost` when a direct Maschinenraum worker is used
- `AI_INFERENCE_ALLOW_PUBLIC_URL=false` (default) blocks public Maschinenraum URLs
- The Maschinenraum connects outbound to UWE and stores no UWE source-of-truth data

---

## Built-in Protections

- **Visibility filtering** — see DM-only section above
- **Share links** — each token is scoped strictly to its own target; expiry, enable/disable, and scrypt-hashed passwords are enforced on every access
- **Rate limiting** — login, share-password, and setup attempts are rate limited per IP (in-memory, per process; use reverse-proxy limits or `setRateLimitStore()` for multi-instance deployments)
- **Settings API validation** — partial settings updates are validated at runtime; unknown keys and invalid enum/path values are rejected with HTTP 400
- **CSRF protection** — sensitive Studio API routes reject cross-origin browser requests
- **Backups** — password hashes, session tokens, and API keys stripped; Zip Slip protection; optional AES-256-GCM encryption (`UWE_BACKUP_ENCRYPTION_KEY`); Studio checkbox creates and downloads, owner-only restore
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
| Assigning the wrong person to a world | High | Zugänge tile shows every address and its worlds; assignment is the only content gate |
| Cloudflare Access misconfiguration | High | Manual policy review per [docs/cloudflare-access.md](docs/cloudflare-access.md) |
| Cross-world read via code regression | Critical | `authz.test.ts`, `world-access.test.ts`, `pnpm test:security` in CI |
| Multi-instance rate limit bypass | Medium | Proxy-level rate limits or `setRateLimitStore()` |
| SQLite concurrent writes | Medium | Single-writer; backup during low activity |
| `AUTH_SECRET` rotation | High | Invalidates Spotify tokens, share passwords — reconnect after rotate |
| Physical host compromise | High | OS hardening, disk encryption |
| 2FA not yet active | Medium | Schema ready (`TwoFactorSecret`); login integration planned |
| Backup completeness gaps | Low | PageTemplates, some metadata — see [docs/BACKUP.md](docs/BACKUP.md) |
| Supply chain (npm) | Medium | `pnpm audit:prod`, frozen lockfile in CI |

**Additional considerations:**

- **A world assignment shows everything** — once an address is assigned to a world, it reads every page, block and asset in it. There is no draft state left: what exists in a world, its members see. Preparation that nobody should read happens outside UWE, or in a world nobody is assigned to yet.
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
- [ ] Maschinenraum and local inference endpoints on private LAN only — never in tunnel config
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
