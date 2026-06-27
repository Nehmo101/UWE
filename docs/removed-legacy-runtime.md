# Removed legacy runtime (Docker, Windows installer, inbound RTX Agent)

UWE was simplified to two clear roles: an always-on **UWE Host** (Linux) and an
optional, outbound **RTX Host Connector**. As part of that simplification, Docker,
the old Windows one-click host installer, and the standalone **inbound** RTX Agent
tool were removed from the **active product path**.

This is an honest record of what changed.

## Why

- The host should run on a small always-on Linux box (an old laptop) with
  Node.js 22, `pnpm` and `systemd` (+ optional Cloudflare Tunnel). That is the
  whole runtime.
- The RTX machine is an optional worker that connects **outbound** to the host.
- Two parallel runtimes (Docker images, a Windows host installer) added surface
  area and drift without serving the target setup. Infrastructure should get
  smaller.

## Removed

| Removed | Replacement / note |
|---------|--------------------|
| `Dockerfile`, `docker-compose.yml`, `.dockerignore` | Linux host: `pnpm build:release` + `pnpm host:start` / `systemd` (`deploy/systemd/uwe.service`). |
| `scripts/docker-entrypoint.sh`, `scripts/docker-db-empty-check.ts`, `scripts/docker-env-check.ts` | Host setup: `deploy/scripts/setup-uwe-host.sh`. |
| `package.json` scripts `docker:build*`, `docker:up`, `docker:down` | `pnpm host:start` / `pnpm host:status` / `pnpm host:stop`. |
| `tools/windows-installer/` (package `@uwe/windows-installer`) | No host installer. Run the host on Linux. |
| `scripts/windows/*.ps1`, `UWE-Installieren.cmd` | No active host product path. |
| `package.json` scripts `installer:windows*`, `launcher:dev`, `package:windows`, `backup`/`restore`/`doctor`/`repair` (installer CLI) | Backups: `pnpm backup:create` (`@uwe/backup`) and `deploy/scripts/uwe-backup.sh`. |
| `.github/workflows/windows-installer.yml`, Docker build jobs | **GitHub Cloud CI** is the authoritative gate (`pr-check.yml` -> `pnpm ci:light`; full `pnpm quality` on `main`). Local commands are an optional pre-check only. |
| `scripts/windows-installer.test.ts`, Docker assertions in `scripts/selfhost.test.ts` | Tests cover the Linux Host + outbound Connector path. `integration-smoke.test.ts` guards that no Docker build job returns. |
| `docs/WINDOWS_INSTALLER.md`, `docs/windows-install.md`, `docs/windows-troubleshooting.md`, `docs/windows-test-checklist.md` | [docs/host-linux.md](host-linux.md), [docs/rtx-connector.md](rtx-connector.md). |
| `tools/uwe-rtx-agent/` (package `@uwe/rtx-agent`, incl. `scripts/rtx-tray.ps1`) | **Removed.** The inbound RTX Agent is no longer shipped. Use the outbound [RTX Host Connector](rtx-connector.md) + direct Ollama/LM Studio. |
| `packages/ai-brain/src/rtx-agent-client.ts`, `packages/ai-brain/src/providers/rtx-agent-provider.ts` | **Removed.** Inbound-agent LLM client/provider; ai-brain inference now uses direct Ollama/LM Studio + the connector. The RTX worker config shim stays only for the security boundary and worker/image path. |

## Kept (still supported)

- Linux host scripts: `deploy/scripts/setup-uwe-host.sh`, `deploy/systemd/*`,
  `scripts/uwe-host-*.sh`, autostart scripts.
- Backup/restore as a feature (`@uwe/backup`, `pnpm backup:create`).
- PostgreSQL as an optional database (`schema.postgresql.prisma`).
- The RTX **worker** security boundary (`@uwe/security` `rtx-boundary`) and the
  RTX worker/image path still resolve and LAN-validate a worker URL. Prefer
  `RTX_BASE_URL` / `RTX_SERVICE_TOKEN`; old agent-named env aliases are read only
  for existing installs and should not appear in new docs or examples.

## Honest status

- The website / Studio / Portal run on the host with **no** Docker and **no**
  Windows host installer.
- The RTX Host Connector is optional; UWE is fully online without it.
- Connector capabilities are intentionally conservative. `audio_local` requires a
  configured local audio command, Ollama is the only executable local LLM provider
  today, `spotify_connect` requires Spotify credentials plus a device ID, and
  `image_generation` requires an explicit local image command.
- The host stores reported capabilities separately from effective capabilities
  and can cap each connector with `allowedCapabilities`.
- The standalone inbound RTX Agent tool **and** its ai-brain LLM client/provider
  (`rtx-agent-client`, `rtx-agent-provider`) have been removed. LLM inference now
  uses direct Ollama/LM Studio (`AI_INFERENCE_BASE_URL`) + the outbound RTX Host
  Connector. `RTX_BASE_URL` / `RTX_SERVICE_TOKEN` are the current worker URL/token
  names for the remaining security-boundary / image-worker path.

## CI truth

**GitHub Cloud CI is the authoritative gate** — see
[engineering/ci.md](engineering/ci.md). PRs are gated by `pr-check.yml`
(`pnpm ci:light`); the full `pnpm quality` gate runs on `main`. A PR is mergeable
when its GitHub checks are green.

The commands below are an **optional local pre-check** to catch problems faster
before pushing — they are not a required or self-hosted gate:

```bash
pnpm install --frozen-lockfile
pnpm --filter @uwe/database db:generate
pnpm lint
pnpm typecheck
pnpm test:ci
pnpm test:security
pnpm build:release
```
