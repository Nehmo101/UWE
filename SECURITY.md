# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

UWE is a private/self-hosted project. If you discover a security issue:

1. **Do not** open a public issue with exploit details.
2. Contact the maintainers directly with a description of the issue, steps to reproduce, and potential impact.
3. Allow reasonable time for a fix before public disclosure.

## Self-Hosting Security Checklist

Before exposing UWE to the internet:

- [ ] Set a strong, unique `AUTH_SECRET` in `.env` (never commit `.env`; replace the `.env.example` placeholder). Keep it stable after connecting Spotify — it encrypts OAuth tokens per world
- [ ] Set `RUN_DB_SEED=false` in production (never auto-seed demo worlds on a live deployment)
- [ ] Run Studio and Portal behind HTTPS (reverse proxy recommended)
- [ ] **Never expose Studio directly to the public internet** — Studio has no user login. Use reverse-proxy auth, VPN, or Cloudflare Access
- [ ] Set `STUDIO_API_TOKEN` when Studio or its APIs may be reachable from untrusted networks (backup, restore, import, settings, AI, export, uploads)
- [ ] Review Portal settings: guest access and public share links make content reachable without login — enable only deliberately
- [ ] Keep Docker images and dependencies updated
- [ ] Back up `./data/` and Docker volume `uwe-database` before updates
- [ ] Review AI provider API keys — store only in `.env`, never in the database or git
- [ ] If running multiple Studio/Portal instances, add rate limiting at the reverse proxy — built-in limits are per-process only

The Studio dashboard and `GET /api/health` surface warnings for common misconfigurations (weak/missing `AUTH_SECRET`, `RUN_DB_SEED` not `false`, missing `STUDIO_API_TOKEN`, active public sharing).

## Built-in Protections

- **Visibility filtering** — `dm_only` pages, blocks, assets, soundboard buttons, session fields, and even secret page *titles* are filtered server-side for the Portal, search, graph, backlinks, related pages, and static export
- **Share links** — each token is scoped strictly to its own target; expiry, enable/disable, and scrypt-hashed passwords are enforced on every access
- **Rate limiting** — login and share-password attempts are rate limited per IP (in-memory, per process; not sufficient alone for multi-instance deployments)
- **Settings API validation** — partial settings updates are validated at runtime; unknown keys and invalid enum/path values are rejected with HTTP 400
- **CSRF protection** — sensitive Studio API routes reject cross-origin browser requests
- **Backups** — password hashes, session tokens, and API keys are stripped before export
- **AI keys** — read from environment only; never stored in the database or returned to clients

## Known Considerations

- **SQLite** — suitable for small to medium deployments; concurrent write limits apply
- **Studio trust model** — Studio assumes a trusted network; it has no per-user login. Never run it publicly without reverse-proxy auth, VPN, or Cloudflare Access. Use `STUDIO_API_TOKEN` for API hardening
- **`AUTH_SECRET`** — encrypts Spotify OAuth tokens per world; must be set to a strong random value in production and kept stable after Spotify connect (rotating it invalidates stored tokens)
- **`RUN_DB_SEED` in production** — must be `false`; `auto`/`true` can create demo content on startup
- **`player_visible` means "no login required"** — published pages/blocks/assets/soundboard buttons with visibility `player_visible` (or `public`) are readable by anyone who can reach the Portal's `/worlds/*` routes. This is by design; the Studio UI labels this visibility as "Portal (ohne Login)" to make the consequence explicit. `dm_only` content is never served on those routes
- **Spotify playback** — OAuth and Web API playback control are Studio-only. The Portal may display Spotify buttons but does not trigger playback
- **Portal sessions** — opaque database-backed tokens (httpOnly, SameSite=Lax, Secure in production); they are not derived from `AUTH_SECRET`
- **File uploads** — stored on disk under `UPLOADS_DIR`; ensure filesystem permissions are restricted
- **Share links** — public URLs grant read access to specific content; review active links regularly
- **Static export** — only portal-visible content is exported; run export audit before publishing externally

## Dependencies

Security updates for Node.js dependencies are applied via `pnpm update` and regular releases.
Run `pnpm audit` periodically in development environments.
