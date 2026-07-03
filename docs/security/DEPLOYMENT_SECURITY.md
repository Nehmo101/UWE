# Deployment Security — UWE Self-Hosting

Guide for deploying UWE behind **Cloudflare Tunnel** with a **public player Portal** and a **protected Studio/Admin** area.

## Architecture

```text
Internet
   |
   v
Cloudflare (DNS + Tunnel + Access)
   |
   |---> Portal (public)     https://wiki.example.com  ->  :3001
   |
   `---> Studio (protected)  https://studio.example.com ->  :3000
                              ^ Cloudflare Access required

Home LAN (NOT in Tunnel)
   `---> Ollama / LM Studio / optional RTX Worker   http://192.168.x.x:11434
```

**Critical rule:** The Cloudflare Tunnel must point **only** to UWE (Studio + Portal). Never expose Ollama, LM Studio, the RTX Host Connector, or any direct RTX worker endpoint to the internet.

## Recommended Cloudflare Setup

### 1. Two hostnames

| Hostname | Service | Cloudflare Access |
|----------|---------|-------------------|
| `wiki.example.com` | Portal (:3001) | Optional (Portal has own login) |
| `studio.example.com` | Studio (:3000) | **Required** |

### 2. Cloudflare Access Policy (Studio)

Create an Access application for `studio.example.com`:

- **Policy:** Allow only your email / identity provider group
- **Session duration:** 24h or less
- **Bypass:** None for production

Without Access, anyone reaching Studio can attempt login — session auth and role gates still apply, but Cloudflare Access should be the **outer** gate for internet-facing Studio deployments. Studio enforces session login when `AUTH_REQUIRED=true` (production default).

### 3. Tunnel configuration

Example `config.yml` (cloudflared):

```yaml
tunnel: uwe-tunnel
credentials-file: /path/to/credentials.json

ingress:
  - hostname: wiki.example.com
    service: http://localhost:3001
  - hostname: studio.example.com
    service: http://localhost:3000
  - service: http_status:404
```

## Environment Variables (Production)

Copy `.env.example` to `.env` and set:

```bash
NODE_ENV=production

# Secrets — generate: openssl rand -base64 32
AUTH_SECRET=<strong-random-secret>
STUDIO_API_TOKEN=<strong-random-token>

# Never seed demo worlds in production
RUN_DB_SEED=false

# Public URLs
PUBLIC_APP_URL=https://wiki.example.com
NEXT_PUBLIC_PORTAL_URL=https://wiki.example.com
NEXT_PUBLIC_STUDIO_URL=https://studio.example.com

# Proxy / Cloudflare
TRUST_PROXY=true
CLOUDFLARE_TUNNEL=true

# Portal auth — require login for guest wiki in production
AUTH_REQUIRED=true
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_SAMESITE=lax

# Player preview — keep DM-only blocked
PLAYER_PREVIEW_ALLOW_DM_ONLY=false
PLAYER_PREVIEW_PUBLIC=false

# Data paths (host)
DATABASE_URL=file:/var/lib/uwe/uwe.db
UWE_DATA_DIR=/var/lib/uwe

# RTX — private LAN only, NOT public URLs
AI_INFERENCE_ALLOW_PUBLIC_URL=false
# AI_INFERENCE_BASE_URL=http://192.168.1.50:11434
# Optional direct worker endpoint for image/security-boundary path:
# RTX_BASE_URL=http://192.168.1.50:8765
# RTX_SERVICE_TOKEN=<rtx-worker-token>

# Upload limit (optional)
# UWE_MAX_UPLOAD_BYTES=52428800
```

## Host Notes

The active host product path is Linux + `pnpm` + `systemd`; Docker and the old Windows host installer are no longer the supported runtime. Keep persistent data under a dedicated host path such as `/var/lib/uwe` and backups under `/var/backups/uwe`.

## Post-Deploy Verification

1. **Health checks**
   - Portal: `GET https://wiki.example.com/api/health`
   - Studio: `GET https://studio.example.com/api/health` (via Access)

2. **Studio Access test**
   - Open `https://studio.example.com` without Access → should be blocked by Cloudflare
   - With Access → Studio dashboard loads

3. **Portal visibility test**
   - Visit `/worlds/*` — only `player_visible`/`public` published content visible
   - Confirm `dm_only` pages return 404

4. **Admin Status Dashboard**
   - Studio → `/admin/status`
   - Check: Studio Security = "geschützt", RTX Exposure = private, Env Validation = no errors
   - Run Public Leak Scanner — 0 critical findings

5. **API protection test**
   ```bash
   # Should fail (403) — cross-origin CSRF simulation
   curl -H "Origin: https://evil.example" https://studio.example.com/api/settings

   # Should fail (401) when STUDIO_API_TOKEN is set — no bearer
   curl https://studio.example.com/api/backup
   ```

6. **Backup test**
   - Create backup via Studio UI
   - Verify downloaded ZIP contains no password hashes or session tokens

## Security Layers Summary

| Layer | Portal | Studio |
|-------|--------|--------|
| Network | Public URL | Cloudflare Access (recommended) |
| Middleware | Auth gate (optional) + headers | Session login + deny-by-default API + CSRF |
| App auth | Session login (`player` roles) | Session login (`owner`/`admin`/`dm`, `AUTH_REQUIRED=true`) |
| API token | N/A | `STUDIO_API_TOKEN` or scoped `uwe_*` tokens |
| Visibility | Server-side filter | Full DM access after login |
| Rate limit | Login, share | Login, backup, import, AI |

## Reverse Proxy Alternative

If not using Cloudflare Tunnel, use nginx/Caddy with:

- Basic auth or OAuth2 proxy on Studio vhost
- TLS termination
- Rate limiting on `/api/auth/login` and `/api/backup`
- `TRUST_PROXY=true`

Example nginx snippet (Studio):

```nginx
location / {
    auth_request /oauth2/auth;  # or auth_basic
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## Monitoring

- Studio dashboard shows production warnings on `/`
- Activity log records security events (category: `security`)
- Check `/admin/status` after config changes

## Assumptions (Documented)

- Single-instance deployment (in-memory rate limits sufficient)
- SQLite database on trusted host filesystem
- DM operates Studio from trusted browser after Cloudflare Access **and** UWE session login
- RTX/AI inference runs on separate machine in home LAN
- Portal `player_visible` content is intentionally world-readable

## Open Risks After Hardening

| Risk | Mitigation | Owner |
|------|------------|-------|
| Cloudflare Access misconfiguration | Manual policy review | Operator |
| Accidental `player_visible` publish | Leak Scanner + Inspector | DM |
| Multi-instance rate limit bypass | Proxy-level rate limits | Operator |
| Physical host compromise | OS hardening, disk encryption | Operator |
| Supply chain (npm) | `pnpm audit`, pinned lockfile | Maintainer |

See [SECURITY.md](../../SECURITY.md) for the full risk matrix and built-in protections.
