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
| SQLite DB | `/var/lib/uwe/uwe.db` (production) or `data/uwe.db` (dev/docker) | Local only |
| Uploads / backups | `/var/lib/uwe/uploads`, `/var/backups/uwe` | Local only |
| RTX Agent | Private LAN IP | **Never public** |

## Linux production host (official)

| Path / Service | Purpose |
|----------------|---------|
| `/opt/uwe` | Git repository |
| `/etc/uwe/uwe.env` | Production env (only official env file) |
| `/var/lib/uwe` | DB, uploads, exports |
| `uwe.service` | systemd unit (only official service) |

| Command | Purpose |
|---------|---------|
| `sudo bash deploy/scripts/setup-uwe-host.sh` | Install / update / repair |
| `sudo bash deploy/scripts/setup-uwe-host.sh --quick` | Fast update after git pull |
| `sudo bash deploy/scripts/setup-uwe-host.sh --healthcheck` | Read-only status |
| `pnpm host:start` | `systemctl start uwe` |
| `pnpm host:stop` | `systemctl stop uwe` |
| `pnpm host:status` | Service status + reachability |

Docs: `docs/UWE_HOST_LINUX_STARTUP.md`, `docs/PRODUCTION.md`.

**Deprecated:** `uwe-host.service`, repo-local `.env` for production, `.uwe-host` state dir.

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

See `docs/BACKUP.md`, `docs/backup-restore.md`. Production backups: `/var/backups/uwe`.

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
