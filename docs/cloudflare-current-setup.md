# Cloudflare — Current Setup

How UWE is exposed via Cloudflare, the expected environment configuration, and
how to verify it in-app. The live status (read-only, no secrets) is shown under
**System → Cloudflare** (`/system/cloudflare`), backed by `getProxyStatus()` in
`packages/database/src/system-status.ts`.

## Architecture: split hostnames (preferred)

UWE runs two Next.js apps that must never intercept each other:

- Studio (DM/admin) — `https://studio.uweanddragons.org`
- Portal (players) — `https://portal.uweanddragons.org`

Recent work aligned the URL/config layer to this split-hostname model. Path-based
routing under one host (`/studio`, `/portal`) is supported as a fallback (Studio
rewrites `PORTAL_PATH` requests to the portal container, see `apps/studio/next.config.ts`),
but split hostnames are the stable, recommended layout because they avoid Studio
catching Portal paths (and vice versa) — the root cause behind "/portal lands in
Studio NotFound".

## Cloudflare Tunnel & Access

- A Cloudflare Tunnel fronts both apps (outbound from the host; no inbound ports).
- Cloudflare Access policies:
  - Studio: restrict to owner/admin email addresses.
  - Portal: open to the Cloudflare edge; UWE's own login gates content.
- The app trusts proxy headers (`TRUST_PROXY=true`) so client IPs and protocol
  are read from Cloudflare headers.

## Environment variables

Set on the host (not committed). The in-app status reflects these:

| Variable | Purpose | Recommended |
|---|---|---|
| `PUBLIC_BASE_URL` | Public origin of the deployment | `https://uweanddragons.org` (or studio host) |
| `STUDIO_PATH` | Studio mount path (path-routing mode) | `/studio` or `/` (split host) |
| `PORTAL_PATH` | Portal mount path (path-routing mode) | `/portal` or `/` (split host) |
| `NEXT_PUBLIC_STUDIO_URL` | Absolute Studio URL for cross-app links | `https://studio.uweanddragons.org` |
| `NEXT_PUBLIC_PORTAL_URL` | Absolute Portal URL for cross-app links | `https://portal.uweanddragons.org` |
| `AUTH_REQUIRED` | Enforce login | `true` |
| `PLAYER_PREVIEW_PUBLIC` | Allow public player preview | `false` |
| `TRUST_PROXY` | Trust Cloudflare proxy headers | `true` |
| `CLOUDFLARE_TUNNEL` | Mark tunnel deployment | `true` |
| `SESSION_COOKIE_SECURE` | Secure cookies (HTTPS only) | `true` in production |

## Cookies behind the proxy

- Session cookies are `httpOnly` and `Secure` (`SESSION_COOKIE_SECURE=true`),
  `SameSite=Lax` by default. Over HTTPS via Cloudflare this is correct; for local
  HTTP testing set `SESSION_COOKIE_SECURE=false` temporarily.
- CSRF is enforced on mutations (same-origin checks); cross-origin Studio API
  requests are rejected at the middleware.

## Acceptance checks

- `https://…/studio` (or the studio host) opens Studio.
- `https://…/portal` (or the portal host) opens the Portal login / "Meine Welten".
- `/portal` never lands in Studio NotFound — Studio exposes a defensive redirect shim at `apps/studio/app/portal/page.tsx` that sends visitors to `NEXT_PUBLIC_PORTAL_URL` (split hostname) or the unified `PORTAL_PATH` mount.
- **System → Cloudflare** shows tunnel/access/routing status (booleans only).

## Verification status

The in-app status page and this document describe the expected configuration as
encoded in the app (`getProxyStatus`) and `.env.example`. Live verification of the
actual Cloudflare Tunnel/Access objects (via the Cloudflare API/MCP) should be
recorded here once run against the production account, including the concrete
hostnames, tunnel id, and Access application/policy names.
