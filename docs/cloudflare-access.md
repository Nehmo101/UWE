# Cloudflare setup for UWE

This document describes the recommended public deployment for UWE after the Portal privacy change.

## Target architecture

UWE uses split hostnames instead of path rewriting:

| Area | Public URL | Local service | Login / protection |
| --- | --- | --- | --- |
| Portal | `https://uweanddragons.org` | Portal `127.0.0.1:3001` | UWE login required |
| Studio | `https://studio.uweanddragons.org` | Studio `127.0.0.1:3000` | UWE/Studio auth, optional Cloudflare Access |
| Health | `/api/health/public` | Matching app | Public probe only |

Normal Portal content is not public anymore. World pages, player pages, share links, dashboard layout APIs, graph APIs and asset file APIs require a UWE session. The Owner manages allowed users and e-mail addresses inside UWE.

## Cloudflare Tunnel

Create DNS CNAME records for both hostnames pointing at the same tunnel target, then use the ingress shape from `deploy/cloudflare/config.yml.example`:

```yaml
tunnel: uwe-host
credentials-file: /etc/cloudflared/uwe-host.json

ingress:
  - hostname: uweanddragons.org
    service: http://127.0.0.1:3001
  - hostname: studio.uweanddragons.org
    service: http://127.0.0.1:3000
  - service: http_status:404
```

This avoids the old `/portal` and `/studio` path-splitting problem. In particular, Portal redirects such as `/auth/worlds` stay on the Portal app instead of falling through to Studio.

## UWE environment

Recommended production values:

```env
PUBLIC_APP_URL=https://uweanddragons.org
NEXT_PUBLIC_PORTAL_URL=https://portal.uweanddragons.org
NEXT_PUBLIC_STUDIO_URL=https://studio.uweanddragons.org
TRUST_PROXY=true
CLOUDFLARE_TUNNEL=true
AUTH_REQUIRED=true
PLAYER_PREVIEW_PUBLIC=false
STUDIO_API_TOKEN=<strong-random-token>
```

If Cloudflare Access is used as an additional Studio layer, also set:

```env
CLOUDFLARE_ACCESS_ENABLED=true
STUDIO_ACCESS_ALLOWED_EMAILS=<owner-email@example.org>
```

Cloudflare Access is optional for the Portal. Do not use it as the primary Portal membership model; UWE users, roles and world memberships are the source of truth.

## Public routes

Keep only these unauthenticated surfaces public:

- Portal and Studio public health probes: `/api/health/public`
- Login/logout and password reset endpoints required for authentication
- Static Next.js assets served by the framework

Everything else should either redirect to `/login` or return `401` from the API middleware when no UWE session exists.

## Legacy unified path setup

The old one-hostname model (`uweanddragons.org/studio`) is still documented in `deploy/cloudflare/Caddyfile.example` for legacy installations only. New installs should not require a local Caddy/nginx proxy just to split Portal and Studio traffic.

## Verification

After deployment:

1. `https://uweanddragons.org/api/health/public` returns HTTP 200.
2. `https://uweanddragons.org/` redirects guests to Portal login.
3. `https://uweanddragons.org/worlds/<slug>` redirects guests to Portal login.
4. `https://uweanddragons.org/api/dashboard-layout/<pageKey>` returns HTTP 401 without a session, not 404.
5. `https://studio.uweanddragons.org/api/health/public` returns HTTP 200.
6. `https://studio.uweanddragons.org/api/dashboard-layout/<pageKey>` is a known protected Studio API route, not an unknown 404.

Automated checks: `pnpm --filter @uwe/auth test`.