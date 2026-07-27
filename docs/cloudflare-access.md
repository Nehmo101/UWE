# Cloudflare setup for UWE

This document describes the recommended public deployment for UWE after the Portal privacy change.

## Target architecture

UWE uses split hostnames instead of path rewriting:

| Area | Public URL | Local service | Login / protection |
| --- | --- | --- | --- |
| Portal | `https://uwe.example` | Portal `127.0.0.1:3001` | UWE login required |
| Studio | `https://studio.uwe.example` | Studio `127.0.0.1:3000` | UWE login (e-mail) required |
| Health | `/api/health/public` | Matching app | Public probe only |

> **No separate Cloudflare Access sign-in.** Studio and Portal are gated by
> UWE's own e-mail login. A Cloudflare Access policy would add a redundant second
> login and is intentionally not used. For a "Verify you are human" gate in front
> of the sites, use a Cloudflare Managed Challenge and/or the in-app Turnstile
> widget (see `docs/cloudflare-current-setup.md`).

Normal Portal content is not public anymore. World pages, player pages, share links, dashboard layout APIs, graph APIs and asset file APIs require a UWE session. The Owner manages allowed users and e-mail addresses inside UWE.

## Cloudflare Tunnel

Create DNS CNAME records for both hostnames pointing at the same tunnel target, then use the ingress shape from `deploy/cloudflare/config.yml.example`:

```yaml
tunnel: uwe-host
credentials-file: /etc/cloudflared/uwe-host.json

ingress:
  - hostname: uwe.example
    service: http://127.0.0.1:3001
  - hostname: studio.uwe.example
    service: http://127.0.0.1:3000
  - service: http_status:404
```

This avoids the old `/portal` and `/studio` path-splitting problem. In particular, Portal redirects such as `/auth/worlds` stay on the Portal app instead of falling through to Studio.

## UWE environment

Recommended production values:

```env
PUBLIC_APP_URL=https://uwe.example
NEXT_PUBLIC_PORTAL_URL=https://portal.uwe.example
NEXT_PUBLIC_STUDIO_URL=https://studio.uwe.example
TRUST_PROXY=true
CLOUDFLARE_TUNNEL=true
AUTH_REQUIRED=true
PLAYER_PREVIEW_PUBLIC=false
STUDIO_API_TOKEN=<strong-random-token>
```

Studio and Portal access is gated by the UWE login (e-mail sign-in) — there is no
separate Cloudflare Access sign-in to configure. UWE users, roles and world
memberships are the source of truth for who may log in.

For a "Verify you are human" check in front of the sites (the full-page
"Verifying you are human…" interstitial), enable a Cloudflare **Managed
Challenge** at the edge (Cloudflare → Security → WAF → custom rule matching the
UWE hostnames, action *Managed Challenge*). Optionally also enable the in-app
Turnstile widget on the login forms via `TURNSTILE_SITE_KEY` /
`TURNSTILE_SECRET_KEY` (see `docs/cloudflare-current-setup.md`). Both are
bot/human checks and do not replace the UWE login.

## Public routes

Keep only these unauthenticated surfaces public:

- Portal and Studio public health probes: `/api/health/public`
- Login/logout and password reset endpoints required for authentication
- Static Next.js assets served by the framework

Everything else should either redirect to `/login` or return `401` from the API middleware when no UWE session exists.

## Legacy unified path setup

The old one-hostname model (`uwe.example/studio`) is still documented in `deploy/cloudflare/Caddyfile.example` for legacy installations only. New installs should not require a local Caddy/nginx proxy just to split Portal and Studio traffic.

## Verification

After deployment:

1. `https://uwe.example/api/health/public` returns HTTP 200.
2. `https://uwe.example/` redirects guests to Portal login.
3. `https://uwe.example/worlds/<slug>` redirects guests to Portal login.
4. `https://uwe.example/api/dashboard-layout/<pageKey>` returns HTTP 401 without a session, not 404.
5. `https://studio.uwe.example/api/health/public` returns HTTP 200.
6. `https://studio.uwe.example/api/dashboard-layout/<pageKey>` is a known protected Studio API route, not an unknown 404.

Automated checks: `pnpm --filter @uwe/auth test`.