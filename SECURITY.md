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

- [ ] Set a strong, unique `AUTH_SECRET` in `.env` (never commit `.env`)
- [ ] Run Studio and Portal behind HTTPS (reverse proxy recommended)
- [ ] Restrict Studio (DM app) to trusted networks or VPN — **Studio has no user login**
- [ ] Optionally set `STUDIO_API_TOKEN` to require a bearer token for sensitive Studio APIs (backup, restore, import, settings, AI, export, uploads) from non-browser clients
- [ ] Keep Docker images and dependencies updated
- [ ] Back up `./data/` and Docker volume `uwe-database` before updates
- [ ] Review AI provider API keys — store only in `.env`, never in the database or git
- [ ] Disable demo seed (`RUN_DB_SEED=false`) in production

## Built-in Protections

- **Visibility filtering** — `dm_only` pages, blocks, assets, session fields, and even secret page *titles* are filtered server-side for the Portal, search, graph, backlinks, related pages, and static export
- **Share links** — each token is scoped strictly to its own target; expiry, enable/disable, and scrypt-hashed passwords are enforced on every access
- **Rate limiting** — login and share-password attempts are rate limited per IP
- **CSRF protection** — sensitive Studio API routes reject cross-origin browser requests
- **Backups** — password hashes, session tokens, and API keys are stripped before export
- **AI keys** — read from environment only; never stored in the database or returned to clients

## Known Considerations

- **SQLite** — suitable for small to medium deployments; concurrent write limits apply
- **Studio trust model** — Studio assumes a trusted network; it has no per-user login. Use network controls (VPN, reverse-proxy auth) and `STUDIO_API_TOKEN`
- **`player_visible` means "no login required"** — published pages/blocks/assets with visibility `player_visible` (or `public`) are readable by anyone who can reach the Portal's `/worlds/*` routes. This is by design; the Studio UI labels this visibility as "Portal (ohne Login)" to make the consequence explicit. `dm_only` content is never served on those routes
- **Portal sessions** — opaque database-backed tokens (httpOnly, SameSite=Lax, Secure in production); they are not derived from `AUTH_SECRET`
- **File uploads** — stored on disk under `UPLOADS_DIR`; ensure filesystem permissions are restricted
- **Share links** — public URLs grant read access to specific content; review active links regularly
- **Static export** — only portal-visible content is exported; run export audit before publishing externally

## Dependencies

Security updates for Node.js dependencies are applied via `pnpm update` and regular releases.
Run `pnpm audit` periodically in development environments.
