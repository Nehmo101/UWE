# Homelab Host Checklist

## First boot

- [ ] Node >= 20, pnpm 10.x
- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm db:migrate` + owner bootstrap if needed
- [ ] `.env` from `.env.example` — unique `AUTH_SECRET`
- [ ] `AUTH_REQUIRED=true` for production
- [ ] `RUN_DB_SEED=false` in production

## RTX connectivity

- [ ] RTX agent reachable from UWE host on LAN
- [ ] RTX URL not in Cloudflare tunnel config
- [ ] Deferred `ai_run` jobs tested when RTX stopped

## Operations

- [ ] Backup cron or manual schedule documented
- [ ] Disk space for `data/uploads` monitored
- [ ] Logs rotated — no sensitive data in logs
- [ ] `pnpm host:status` returns healthy

## Optional

- [ ] PostgreSQL migration path (`docs/postgresql.md`)
- [ ] Redis for rate limits (`UWE_REDIS_URL`)
- [ ] Self-hosted GitHub runner (see self-hosted-ci doc)
