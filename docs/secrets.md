# UWE Secrets & Environment Variables

This document describes which secrets UWE needs, how to generate them safely, and what must never be committed to git.

Canonical validation lives in `packages/env/src/config/env.ts` (`@uwe/env`). Production startup fails when critical secrets are missing or weak.

## Required in production

| Variable | Purpose | Generate |
|----------|---------|----------|
| `SESSION_SECRET` | Encrypts OAuth tokens, share passwords, and other server-side secrets. Legacy alias: `AUTH_SECRET`. | `openssl rand -base64 32` |
| `UWE_SETUP_TOKEN` | Protects setup/repair/bootstrap operations from unauthorized use. | `openssl rand -base64 32` |
| `DATABASE_URL` | SQLite/libsql database location, e.g. `file:/var/lib/uwe/uwe.db` | Choose a persistent host path |
| `PUBLIC_BASE_URL` | Public HTTPS URL for cookies, links, and proxy detection. Legacy alias: `PUBLIC_APP_URL`. | Your public domain, e.g. `https://uwe.example.org` |
| `NODE_ENV` | Must be `production` on production hosts | `production` |

Also set:

- `RUN_DB_SEED=false` — disables demo seeding
- `STUDIO_API_TOKEN` — strongly recommended when Studio or APIs may be reachable from untrusted networks

## Optional

| Variable | Purpose |
|----------|---------|
| `RTX_BASE_URL` | Direct RTX worker URL for the remaining image-worker/security-boundary path |
| `RTX_SERVICE_TOKEN` | Bearer token for that direct RTX worker URL |
| `MAX_UPLOAD_MB` | Maximum upload size for Studio assets (default: `50`) |
| `STUDIO_API_TOKEN` | Bearer token for sensitive Studio APIs |
| `SMTP_PASSWORD`, `CLOUD_AI_API_KEY`, provider API keys | Feature-specific secrets |

`RTX_BASE_URL` and `RTX_SERVICE_TOKEN` must be set together or not at all. For local LLM work prefer direct Ollama/LM Studio through `AI_INFERENCE_BASE_URL` and the outbound RTX Host Connector.

## Development defaults

Local development may run without production-only secrets. Demo login credentials (`dm@uwe.local` / `uwe-dev`) exist only in seed data and dev UI hints — never use them in production.

Copy `.env.example` to `.env` and replace placeholders before deploying.

## Generating secrets

```bash
# Session / crypto secret (32+ bytes recommended)
openssl rand -base64 32

# Setup token
openssl rand -base64 32

# Studio API bearer token
openssl rand -base64 32
```

On Windows without OpenSSL, use PowerShell:

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

The old Windows host installer is no longer part of the active product path. Fresh installs should generate `SESSION_SECRET` during Linux host setup.

## Never commit

- `.env`, `.env.local`, `.env.*.local`
- Real API keys, tokens, passwords, or private URLs
- Database files (`*.db`) and upload/backup directories with user data
- TLS private keys or Cloudflare tunnel credentials
- OAuth client secrets (`SPOTIFY_CLIENT_SECRET`, etc.)
- SMTP passwords, CalDAV passwords, GitHub/Cursor tokens

Safe to commit:

- `.env.example` with placeholders only
- Documentation describing variable names (not values)
- Test fixtures with obviously fake values in `*.test.ts` files

## Validation & redaction

- **Startup:** `assertProductionEnvReady()` runs via Next.js `instrumentation.ts` in Studio and Portal when `NODE_ENV=production`.
- **Weak secrets:** Placeholders like `change-me`, `uwe-dev`, and values shorter than 16 characters are rejected in production.
- **Logs:** Use `redactSecrets()` from `@uwe/env` before writing errors or diagnostics. Known env values and common secret patterns are replaced with `[REDACTED]`.

## Repository checks

```bash
pnpm secret:scan
```

This runs a lightweight pattern scan. For CI or pre-release audits, also consider [gitleaks](https://github.com/gitleaks/gitleaks) or [trufflehog](https://github.com/trufflesecurity/trufflehog) against the full git history.

## Rotation notes

- Rotating `SESSION_SECRET` invalidates encrypted Spotify tokens and share-password hashes — reconnect/reconfigure after rotation.
- Rotating `UWE_SETUP_TOKEN` requires updating automation/scripts that call protected setup endpoints.
- Rotating `STUDIO_API_TOKEN` requires updating API clients and backup scripts.

See also: [docs/PRODUCTION.md](./PRODUCTION.md), [SECURITY.md](../SECURITY.md).
