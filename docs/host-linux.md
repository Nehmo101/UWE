# UWE Host (Linux)

The **UWE Host** is the always-on instance and the **source of truth**: website,
Studio, Portal, database, auth, uploads, queue, settings and public reachability.
It runs on a small Linux box (an old laptop is fine) with Node.js 22, `pnpm` and
`systemd`.

The host must boot and serve **without** any RTX connector.

## Requirements

- Linux (Debian/Ubuntu-like), Node.js 22, `pnpm` (`packageManager` pinned in
  `package.json`).
- A persistent data directory for SQLite, uploads, backups and exports.

## Manual run (quick)

```bash
cp .env.example .env                       # set SESSION_SECRET/AUTH_SECRET
pnpm install --frozen-lockfile
pnpm --filter @uwe/database db:deploy      # migrations
pnpm --filter @uwe/database db:seed        # optional demo world
pnpm build:release
pnpm host:start                            # Studio :3000, Portal :3001
pnpm host:status                           # health
pnpm host:stop
```

## Local CI gate

CI is currently expected to run locally from the repository root; do not assume
GitHub Actions as the source of truth for this rework. Use Node.js 22 and run:

```bash
pnpm install --frozen-lockfile
pnpm --filter @uwe/database db:generate
pnpm lint
pnpm typecheck
pnpm test:ci
pnpm test:security
pnpm build:release
```

The checks intentionally target the Linux Host + outbound RTX Connector path.
Failures from removed Docker or Windows-installer paths should be updated to the
new architecture, not deleted blindly.

## Production (systemd, recommended)

A one-shot setup script provisions Node, dependencies, the database, the
`uwe.service` systemd unit and (optionally) host-update assets:

```bash
sudo bash deploy/scripts/setup-uwe-host.sh            # full
sudo bash deploy/scripts/setup-uwe-host.sh --quick    # update existing host
sudo bash deploy/scripts/uwe-host-status.sh --healthcheck
```

The reference unit is `deploy/systemd/uwe.service` (restart limits, pinned Node
path, `EnvironmentFile=-/etc/uwe/uwe.env`). Autostart:

```bash
sudo systemctl enable uwe.service
sudo systemctl start uwe.service
journalctl -u uwe.service -f -n 100
```

See also [UWE_HOST_LINUX_STARTUP.md](UWE_HOST_LINUX_STARTUP.md) and
[deployment-hardening.md](deployment-hardening.md).

## Public reachability (optional)

A **Cloudflare Tunnel** maps public hostnames to local ports (Studio `:3000`,
Portal `:3001`). No inbound ports need to be opened on the host. See
[cloudflare-access.md](cloudflare-access.md). Set `TRUST_PROXY=true` behind a
proxy and `PUBLIC_BASE_URL` to the public URL.

## Database

SQLite (libsql) is the default. PostgreSQL is optional via
`schema.postgresql.prisma` + `pnpm --filter @uwe/database db:deploy:postgres`.
The host is always the data truth — there is **no** DB replication to the RTX
machine.

## Behaviour without an RTX connector

Studio, Portal, login and worlds stay fully online. Soundboard UI is visible but
local audio returns the normal degraded response when no online connector
advertises `audio_local`. Local AI and image generation must make the same kind
of honest degraded/stub state clear. No crashes — this is the expected degraded
state. See [rtx-connector.md](rtx-connector.md).
