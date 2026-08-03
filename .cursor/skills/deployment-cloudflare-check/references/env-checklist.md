# UWE Deployment & Cloudflare ENV Checklist

## Required production ENV

From `.env.example`, `.env.production.example`, `docs/security/DEPLOYMENT_SECURITY.md`:

```bash
NODE_ENV=production

# Secrets — openssl rand -base64 32
AUTH_SECRET=<strong-random>
STUDIO_API_TOKEN=<strong-random>          # required if publicly reachable

RUN_DB_SEED=false                           # never seed demo in production

# Public URLs
PUBLIC_APP_URL=https://wiki.example.com
NEXT_PUBLIC_PORTAL_URL=https://wiki.example.com
NEXT_PUBLIC_STUDIO_URL=https://studio.example.com

# Proxy / Cloudflare
TRUST_PROXY=true
CLOUDFLARE_TUNNEL=true

# Optional restore guard for remote scripts
RESTORE_OWNER_TOKEN=<optional>

# Portal auth in production
AUTH_REQUIRED=true                          # when exposing Portal publicly
```

## Data paths (persistent)

| Variable | Typical Linux path |
|----------|-------------------|
| `UWE_DATA_DIR` | `/var/lib/uwe` |
| `DATABASE_URL` | `file:/var/lib/uwe/uwe.db` |
| `UWE_UPLOADS_DIR` | `/var/lib/uwe/uploads` |
| `UWE_BACKUP_DIR` | `/var/backups/uwe` |
| `UWE_EXPORT_DIR` | `/var/lib/uwe/exports` |

Studio Settings can override ENV paths.

## Cloudflare Tunnel config

Example `config.yml`:

```yaml
tunnel: uwe-tunnel
credentials-file: /path/to/credentials.json

ingress:
  - hostname: wiki.example.com
    service: http://127.0.0.1:3001    # Portal
  - hostname: studio.example.com
    service: http://127.0.0.1:3000    # Studio
  - service: http_status:404
```

### Host binding

UWE should listen on **127.0.0.1** only; UFW blocks WAN ports. See `docs/deployment-hardening.md`.

## Cloudflare Access

| Hostname | Access policy |
|----------|---------------|
| Portal (`wiki.*`) | Optional — Portal has own login |
| Studio (`studio.*`) | **Required** — session login exists but grants DM access; Access is the outer gate |

Manual checklist (not server-verifiable):

- [ ] Access application for Studio hostname
- [ ] Allow only admin email/group
- [ ] No bypass rules in production
- [ ] Maschinenraum/Ollama URLs **not** in tunnel config

See `docs/cloudflare-access.md` for path-level policies.

## Health endpoints

| Endpoint | Exposure | Returns |
|----------|----------|---------|
| `GET /api/health/public` | Public | Minimal `ok` |
| `GET /api/health/private` | Token/owner | Full diagnostics |
| `GET /api/health` | Varies | App-specific |

## Pre-go-live commands

```bash
git pull && pnpm install --frozen-lockfile
pnpm build:release
pnpm --filter @uwe/database db:deploy
docker compose up -d          # or systemd units from deployment-hardening.md
curl -sf http://127.0.0.1:3000/api/health/public
curl -sf http://127.0.0.1:3001/api/health/public
```

## Production safety warnings

`production-safety.ts` flags:

- Missing `AUTH_SECRET` / demo seed enabled
- Public URL without `STUDIO_API_TOKEN`
- Cloudflare tunnel without proxy flags
- Maschinenraum inference URL pointing to public host

## Maschinenraum / AI (LAN only)

```bash
# Correct — LAN IP
INFERENCE_BASE_URL=http://192.168.x.x:11434

# Wrong — never use public URL or Cloudflare hostname
```

## Backup before go-live

```bash
pnpm backup:create
# or copy uwe.db + uploads directory
```

See `docs/backup-restore.md`.

## Related docs

- `docs/deployment-hardening.md` — Linux laptop + systemd
- `docs/PRODUCTION.md` — release checklist
- `docs/security/DEPLOYMENT_SECURITY.md` — architecture overview
- `docs/cloudflare-access.md` — Access policies for uwe.example
