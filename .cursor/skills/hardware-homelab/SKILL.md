---
name: hardware-homelab
description: Operate UWE on self-hosted hardware — Linux host scripts, Docker, RTX agent isolation, backups, autostart, and homelab CI runners. Use when setting up hosts, troubleshooting local inference, or planning self-hosted CI.
---

# UWE Hardware / Homelab

## Host layout

| Component | Location | Exposure |
|-----------|----------|----------|
| UWE Studio | `:3000` | Cloudflare Tunnel (protected) |
| UWE Portal | `:3001` | Cloudflare Tunnel (public wiki) |
| SQLite DB | `data/uwe.db` or Docker volume | Local only |
| Uploads / backups | `data/uploads`, `data/backups` | Local only |
| RTX Agent | Private LAN IP | **Never public** |

## Host scripts (Linux)

| Command | Purpose |
|---------|---------|
| `pnpm host:start` | Start Studio + Portal via `scripts/uwe-host-start.sh` |
| `pnpm host:stop` | Stop services |
| `pnpm host:status` | Health check |
| `pnpm host:install-autostart` | systemd user service |

Docs: `docs/UWE_HOST_LINUX_STARTUP.md`, `docs/PRODUCTION.md`.

## Docker

```bash
pnpm docker:build
pnpm docker:up
```

`docker-compose.yml` — Studio + Portal + SQLite volume. RTX runs **outside** compose on gaming PC.

## RTX agent

- Package: `tools/uwe-rtx-agent/`
- ENV: internal URL only (e.g. `http://192.168.x.x:11434`)
- Inference only — no UWE DB on RTX machine
- Skill: `local-first-privacy` for routing rules

## Backups

```bash
pnpm backup:create
# or Windows: pnpm backup / pnpm restore
```

See `docs/BACKUP.md`, `docs/backup-restore.md`. Test restore on homelab before relying on backups.

## Self-hosted CI (planned)

`docs/engineering/self-hosted-ci.md` — GitHub runner on homelab, billing alternatives. Not required for local dev — use `pnpm quality`.

## Windows installer

- `tools/windows-installer/` — one-click setup for DM PCs
- `pnpm doctor`, `pnpm repair` for maintenance

## Security on homelab

1. Separate VLAN or firewall rule for RTX — no inbound from internet
2. Strong `AUTH_SECRET`, `AUTH_REQUIRED=true` in prod
3. Cloudflare Access on Studio admin paths
4. Run `pnpm test:security` after network changes

## Related

- Skill: `deployment-cloudflare-check` — tunnel + Access checklist
- Skill: `local-first-privacy`
- Docs: `docs/engineering/self-hosted-ci.md`, `SECURITY.md`

Details: [references/host-checklist.md](references/host-checklist.md)
