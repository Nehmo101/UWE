# Removed legacy runtime (Docker + Windows installer)

UWE was simplified to two clear roles: an always-on **UWE Host** (Linux) and an
optional, outbound **RTX Host Connector**. As part of that simplification, Docker
and the Windows one-click installer were removed from the **active product path**.

This is an honest record of what changed.

## Why

- The host should run on a small always-on Linux box (an old laptop) with
  Node.js 22, `pnpm` and `systemd` (+ optional Cloudflare Tunnel). That is the
  whole runtime.
- The RTX machine is an optional worker that connects **outbound** to the host.
- Two parallel runtimes (Docker images, a Windows installer) added surface area
  and drift without serving the target setup. Infrastructure should get smaller.

## Removed

| Removed | Replacement / note |
|---------|--------------------|
| `Dockerfile`, `docker-compose.yml`, `.dockerignore` | Linux host: `pnpm build:release` + `pnpm host:start` / `systemd` (`deploy/systemd/uwe.service`). |
| `scripts/docker-entrypoint.sh`, `scripts/docker-db-empty-check.ts`, `scripts/docker-env-check.ts` | Host setup: `deploy/scripts/setup-uwe-host.sh`. |
| `package.json` scripts `docker:build*`, `docker:up`, `docker:down` | `pnpm host:start` / `pnpm host:status` / `pnpm host:stop`. |
| `tools/windows-installer/` (package `@uwe/windows-installer`) | No installer. Run the host on Linux. |
| `scripts/windows/*.ps1`, `UWE-Installieren.cmd` | No active product path. |
| `package.json` scripts `installer:windows*`, `launcher:dev`, `package:windows`, `backup`/`restore`/`doctor`/`repair` (installer CLI) | Backups: `pnpm backup:create` (`@uwe/backup`) and `deploy/scripts/uwe-backup.sh`. |
| `.github/workflows/windows-installer.yml`, Docker build jobs | Local CI is the current gate: lint, typecheck, unit/security tests, migration checks, connector + queue tests, release build. |
| `scripts/windows-installer.test.ts`, Docker assertions in `scripts/selfhost.test.ts` | Tests should cover the Linux Host + outbound Connector path. |
| `docs/WINDOWS_INSTALLER.md`, `docs/windows-install.md`, `docs/windows-troubleshooting.md`, `docs/windows-test-checklist.md` | [docs/host-linux.md](host-linux.md), [docs/rtx-connector.md](rtx-connector.md). |

## Kept (still supported)

- Linux host scripts: `deploy/scripts/setup-uwe-host.sh`, `deploy/systemd/*`,
  `scripts/uwe-host-*.sh`, autostart scripts.
- Backup/restore as a feature (`@uwe/backup`, `pnpm backup:create`).
- PostgreSQL as an optional database (`schema.postgresql.prisma`).
- The legacy **inbound** RTX agent (`tools/uwe-rtx-agent`, `RTX_AGENT_URL`) remains
  for existing setups but is **deprecated** in favour of the outbound connector.

## Honest status

- The website / Studio / Portal run on the host with **no** Docker and **no**
  Windows installer.
- The RTX Host Connector is optional; UWE is fully online without it.
- Connector capabilities are intentionally conservative. `audio_local` requires a
  configured local audio command, Ollama is the only executable local LLM provider
  today, `spotify_connect` requires Spotify credentials plus a device ID, and
  `image_generation` requires an explicit local image command.
- The host stores reported capabilities separately from effective capabilities
  and can cap each connector with `allowedCapabilities`.
- Fully migrating the inbound AI path (`RTX_AGENT_URL`) onto the connector queue is
  a follow-up; today both coexist and the connector is the recommended direction.

## Local CI

Run this from the repo root on Node.js 22:

```bash
pnpm install --frozen-lockfile
pnpm --filter @uwe/database db:generate
pnpm lint
pnpm typecheck
pnpm test:ci
pnpm test:security
pnpm build:release
```
