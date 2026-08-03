---
name: hardware-homelab
description: Operate UWE on self-hosted hardware — Linux host scripts, Docker, Maschinenraum agent isolation, backups, autostart, and homelab CI runners. Use when setting up hosts, troubleshooting local inference, or planning self-hosted CI.
---

# UWE Hardware / Homelab

## Host layout

| Component | Location | Exposure |
|-----------|----------|----------|
| UWE Studio | `:3000` | Cloudflare Tunnel (protected) |
| UWE Portal | `:3001` | Cloudflare Tunnel (public wiki) |
| SQLite DB | `/var/lib/uwe/uwe.db` (production) or `data/uwe.db` (dev/docker) | Local only |
| Uploads / backups | `/var/lib/uwe/uploads`, `/var/backups/uwe` | Local only |
| Maschinenraum-Agent | Private LAN IP | **Never public** |

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

## Docker (historical, not an active product path)

Do not build a new deployment around Docker. Active paths are the Windows UWE Command Center and the Linux systemd host.

## Maschinenraum inference (outbound connector)

- Active package: `tools/uwe-engine-connector/` (`pnpm connector:start`) — outbound worker, no inbound port
- Legacy inbound Maschinenraum agent (`ENGINE_AGENT_URL`) is deprecated; the standalone tool was removed
- ENV: internal URL only (e.g. `http://192.168.x.x:11434`)
- Inference only — no UWE DB on Maschinenraum machine
- Skill: `local-first-privacy` for routing rules

## Backups

```bash
pnpm backup:create
# or Windows: pnpm backup / pnpm restore
```

See `docs/BACKUP.md`, `docs/backup-restore.md`. Production backups: `/var/backups/uwe`.

## Self-hosted CI (planned)

`docs/engineering/self-hosted-ci.md` — GitHub runner on homelab, billing alternatives. Not required for local dev — use `pnpm quality`.

## Windows UWE Command Center

- Active desktop app: `apps/engine-connector-client/` (technical path retained for compatibility)
- Host orchestrator: `tools/uwe-host-command-center/src/desktop-host-cli.ts`
- `pnpm command-center:dev` / `pnpm command-center:build`
- Persistent data: `%LOCALAPPDATA%\UWE\engine-connector-client\host`
- The removed `tools/windows-installer/` path must not be restored.
- Full workflow: `docs/command-center.md`

## Security on homelab

1. Separate VLAN or firewall rule for Maschinenraum — no inbound from internet
2. Strong `AUTH_SECRET`, `AUTH_REQUIRED=true` in prod
3. Cloudflare Access on Studio admin paths
4. Run `pnpm test:security` after network changes

## Related

- Skill: `deployment-cloudflare-check` — tunnel + Access checklist
- Skill: `local-first-privacy`
- Docs: `docs/engineering/self-hosted-ci.md`, `SECURITY.md`

Details: [references/host-checklist.md](references/host-checklist.md)
