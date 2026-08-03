# Homelab Host Checklist

## First boot (Linux production)

- [ ] Clone to `/opt/uwe`, run `sudo bash deploy/scripts/setup-uwe-host.sh`
- [ ] Node.js 22 on host (setup script installs via `--repair` if needed)
- [ ] Env at `/etc/uwe/uwe.env` — unique `AUTH_SECRET`, `UWE_SETUP_TOKEN`
- [ ] `RUN_DB_SEED=false` in production
- [ ] `uwe.service` enabled: `systemctl is-enabled uwe`
- [ ] Owner bootstrap via `http://127.0.0.1:3000/setup`

## Maschinenraum connectivity

- [ ] Maschinenraum agent reachable from UWE host on LAN
- [ ] Maschinenraum URL not in Cloudflare tunnel config
- [ ] Deferred `ai_run` jobs tested when Maschinenraum stopped

## Operations

- [ ] Backup cron or manual schedule documented (`/var/backups/uwe`)
- [ ] Disk space for `/var/lib/uwe/uploads` monitored
- [ ] Logs rotated — no sensitive data in logs (`journalctl -u uwe`)
- [ ] `pnpm host:status` or `setup-uwe-host.sh --healthcheck` returns healthy

## Optional

- [ ] PostgreSQL migration path (`docs/postgresql.md`)
- [ ] Redis for rate limits (`UWE_REDIS_URL`)
- [ ] Self-hosted GitHub runner (see self-hosted-ci doc)
