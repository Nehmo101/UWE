# Cloudflare — Current Setup

How UWE is exposed via Cloudflare, the expected environment configuration, and
how to verify it in-app. The live status (read-only, no secrets) is shown under
**System → Cloudflare** (`/system/cloudflare`), backed by `getProxyStatus()` in
`packages/database/src/system-status.ts`.

## Architecture: split hostnames (preferred)

UWE runs Next.js apps that must never intercept each other, each on its own
origin and in its own process:

- Landing (public) — `https://uweanddragons.org` (`apps/landing`, `:3103`)
- Studio (DM/admin) — `https://studio.uweanddragons.org` (`apps/studio`, `:3000`)
- Portal (players) — `https://portal.uweanddragons.org` (`apps/portal`, `:3001`)
- Brain (owner-only) — `https://brain.uweanddragons.org` (`apps/brain`, `:3002`)

Recent work aligned the URL/config layer to this split-hostname model. Path-based
routing under one host (`/studio`, `/portal`) is supported as a fallback (Studio
rewrites `PORTAL_PATH` requests to the portal container, see `apps/studio/next.config.ts`),
but split hostnames are the stable, recommended layout because they avoid Studio
catching Portal paths (and vice versa) — the root cause behind "/portal lands in
Studio NotFound".

## Cloudflare Tunnel

- A Cloudflare Tunnel fronts both apps (outbound from the host; no inbound ports).
- **Access / login:** both Studio and Portal are gated by UWE's own login
  (e-mail sign-in) when `AUTH_REQUIRED=true`. There is **no separate Cloudflare
  Access sign-in** — a Cloudflare Access policy would add a redundant second
  login and is intentionally not used.
- **"Verify you are human":** an optional Cloudflare Managed Challenge at the
  edge (and/or the in-app Turnstile widget, see below) can gate the sites; this
  is a bot/human check, not a login.
- The app trusts proxy headers (`TRUST_PROXY=true`) so client IPs and protocol
  are read from Cloudflare headers.

## Environment variables

Set on the host (not committed). The in-app status reflects these:

| Variable | Purpose | Recommended |
|---|---|---|
| `PUBLIC_BASE_URL` | Public origin of the deployment (the apex/landing origin) | `https://uweanddragons.org` (or studio host) |
| `LANDING_PORT` | Port of the apex landing app (`apps/landing`) | `3103` |
| `STUDIO_PATH` | Studio mount path (path-routing mode) | `/studio` or `/` (split host) |
| `PORTAL_PATH` | Portal mount path (path-routing mode) | `/portal` or `/` (split host) |
| `NEXT_PUBLIC_STUDIO_URL` | Absolute Studio URL for cross-app links | `https://studio.uweanddragons.org` |
| `NEXT_PUBLIC_PORTAL_URL` | Absolute Portal URL for cross-app links | `https://portal.uweanddragons.org` |
| `AUTH_REQUIRED` | Enforce login | `true` |
| `PLAYER_PREVIEW_PUBLIC` | Allow public player preview | `false` |
| `TRUST_PROXY` | Trust Cloudflare proxy headers | `true` |
| `CLOUDFLARE_TUNNEL` | Mark tunnel deployment | `true` |
| `SESSION_COOKIE_SECURE` | Secure cookies (HTTPS only) | `true` in production |
| `SESSION_COOKIE_DOMAIN` | Cookie `Domain` for cross-subdomain SSO | `.uweanddragons.org` (unset = host-only) |

## Landing page + single sign-on across subdomains

The apex `https://uweanddragons.org` serves the public **landing page** from its
own app (`apps/landing`, `:3103`) — deliberately *not* from the Studio container,
so the main domain never ships Studio code. A visitor chooses **UWE Studio**,
**UWE Portal** or **UWE Brain** and signs in in place; the landing's
`POST /api/auth/enter` authenticates against UWE Core (Studio/Brain targets
require GM access; Portal accepts any active user), then the browser is sent to
`studio.` / `portal.` / `brain.uweanddragons.org`.

The apex exposes exactly three routes — `/`, `/api/auth/enter`, `/api/health`.
Its middleware is a closed allowlist: unknown page paths 308-redirect to the
Studio host (old `uweanddragons.org/today` bookmarks keep working), unknown API
paths answer 404. Conversely, `studio.uweanddragons.org/` no longer renders the
landing: anonymous visitors get a 307 to `/login`, signed-in ones go to the
configured Studio entry page.

Without split hostnames (`unified-path` or local development) there is no
separate apex, so `apps/studio/app/page.tsx` keeps rendering the landing at `/`
as before — that fallback is intact and covered by the deployment-model check in
that file.

For that redirect to stay signed in, set **`SESSION_COOKIE_DOMAIN=.uweanddragons.org`**
so the session cookie is shared across all subdomains (SSO). Left unset, the
cookie is host-only and each origin must sign in separately. Only set this for a
domain you fully control — every subdomain can then read the session; per-page
authorization (e.g. Studio still rejects players) is unaffected.

## "Verify you are human" check (Cloudflare Turnstile)

UWE can show a Cloudflare **Turnstile** "Verify you are human" widget on the
Studio and Portal login forms — the same kind of human-check pictured on managed
Cloudflare sites — and verify the resulting token server-side before sign-in.
This is the in-app entry gate that protects login regardless of whether a
Cloudflare Tunnel/Access sits in front.

Configuration (host env, never committed):

| Variable | Purpose |
|---|---|
| `TURNSTILE_SITE_KEY` | Public site key rendered in the browser widget |
| `TURNSTILE_SECRET_KEY` | Secret key used for server-side `siteverify` (never sent to the client) |
| `TURNSTILE_ENABLED` | Optional kill-switch (`false` disables even when keys are set) |

Behaviour:

- The check is **opt-in**: with no keys configured every helper is a no-op, so
  local development and self-hosters without Cloudflare keep working unchanged.
- When both keys are present, login is blocked until a valid token is verified.
  Verification **fails closed** (network/timeout errors block the attempt) and
  failed attempts are recorded in the login audit log
  (`human_verification_failed`).
- The strict CSP is widened **only when enabled** to allow the Turnstile origin
  (`https://challenges.cloudflare.com`) in `script-src`, `connect-src` and
  `frame-src`. See `packages/auth/src/security-headers.ts`.
- Create keys at **Cloudflare → Turnstile** (managed widget). Cloudflare also
  publishes always-pass/always-block test keys for QA — never use them in
  production.

Verification module: `packages/auth/src/turnstile.ts`. Live status (booleans
only, no secrets) is shown under **System → Cloudflare** (`/system/cloudflare`).

### Edge-level alternative (full-page interstitial)

For a full-page "Checking your browser / Verify you are human" interstitial in
front of *everything* (not just login), enable a Cloudflare **Managed Challenge**
at the edge: Cloudflare dashboard → Security → WAF → custom rule matching the UWE
hostname(s) with action *Managed Challenge* (or "I'm Under Attack" mode). That is
a dashboard/WAF setting with no UWE code change and can be combined with the
in-app Turnstile widget above.

## Cookies behind the proxy

- Session cookies are `httpOnly` and `Secure` (`SESSION_COOKIE_SECURE=true`),
  `SameSite=Lax` by default. Over HTTPS via Cloudflare this is correct; for local
  HTTP testing set `SESSION_COOKIE_SECURE=false` temporarily.
- CSRF is enforced on mutations (same-origin checks); cross-origin Studio API
  requests are rejected at the middleware.

## Acceptance checks

- `https://uweanddragons.org/` opens the landing chooser; `/api/health` there
  reports `"app": "UWE Landing"` (not "UWE Studio") — that is the check that the
  apex really runs its own process.
- `https://uweanddragons.org/today` (any non-landing path) 308-redirects to the
  Studio host; `https://uweanddragons.org/api/admin/status` answers 404.
- `https://studio.uweanddragons.org/` 307-redirects to `/login` when signed out —
  the landing must not appear on the Studio host.
- `https://…/studio` (or the studio host) opens Studio.
- `https://…/portal` (or the portal host) opens the Portal login / "Meine Welten".
- `/portal` never lands in Studio NotFound — Studio exposes a defensive redirect shim at `apps/studio/app/portal/page.tsx` that sends visitors to `NEXT_PUBLIC_PORTAL_URL` (split hostname) or the unified `PORTAL_PATH` mount.
- **System → Cloudflare** shows tunnel/access/routing status (booleans only).

## Verification status (2026-06-30, host uwe-host)

Live checks on this host:

| Check | Status |
|---|---|
| `cloudflared.service` | active, QUIC healthy |
| Tunnel ingress (remote) | `studio.uweanddragons.org` → `:3000`; `uweanddragons.org` → Landing `:3103` (Stand 2026-07-26; davor Studio `:3000`) |
| `portal.uweanddragons.org` | **pending** — DNS + Tunnel-Ingress via Dashboard oder `configure-cloudflare-tunnel.sh` |
| UWE env | `NEXT_PUBLIC_STUDIO_URL=https://studio.uweanddragons.org`, `NEXT_PUBLIC_PORTAL_URL=https://portal.uweanddragons.org` |
| Studio root | HTTP 200 (nach Service-Neustart mit aktuellem Build) |

Apply tunnel ingress:

```bash
# Option A — API (empfohlen)
CLOUDFLARE_API_TOKEN=... bash /opt/uwe/deploy/scripts/configure-cloudflare-tunnel.sh

# Option B — Zero Trust Dashboard → Tunnels → Public Hostname:
#   portal.uweanddragons.org → http://127.0.0.1:3001
```

Automated checks: `bash /opt/uwe/deploy/scripts/check-cloudflare-tunnel.sh`
