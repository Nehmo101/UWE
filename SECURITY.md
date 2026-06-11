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
- [ ] Restrict Studio (DM app) to trusted networks or VPN if possible
- [ ] Keep Docker images and dependencies updated
- [ ] Back up `./data/` and Docker volume `uwe-database` before updates
- [ ] Review AI provider API keys — store only in `.env`, never in the database or git
- [ ] Disable demo seed (`RUN_DB_SEED=false`) in production

## Known Considerations

- **SQLite** — suitable for small to medium deployments; concurrent write limits apply
- **File uploads** — stored on disk under `UPLOADS_DIR`; ensure filesystem permissions are restricted
- **Share links** — public URLs grant read access to specific content; review active links regularly
- **Static export** — only portal-visible content is exported; run export audit before publishing externally

## Dependencies

Security updates for Node.js dependencies are applied via `pnpm update` and regular releases.
Run `pnpm audit` periodically in development environments.
