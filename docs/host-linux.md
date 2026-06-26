# UWE Host (Linux)

The **UWE Host** is the always-on instance and the **source of truth**: website,
Studio, Portal, database, auth, uploads, queue, settings and public reachability.
It runs on a small Linux box (an old laptop is fine) with `pnpm` + `systemd`.

The host must boot and serve **without** any RTX connector.

## Requirements

- Linux (Debian/Ubuntu-like), Node.js 20+, `pnpm` (`packageManager` pinned in
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
local audio shows "RTX Connector offline"; local AI and image generation show the
same calm notice. No crashes — this is the expected degraded state. See
[rtx-connector.md](rtx-connector.md).
