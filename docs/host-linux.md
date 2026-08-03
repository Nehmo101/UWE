# UWE Host (Linux)

The **UWE Host** is the always-on instance and the **source of truth**: website,
Studio, Portal, database, auth, uploads, queue, settings and public reachability.
It runs on a small Linux box (an old laptop is fine) with Node.js 22, `pnpm` and
`systemd`.

The host must boot and serve **without** any Maschinenraum connector.

## Requirements

- Linux (Debian/Ubuntu or Fedora 44), Node.js 22, `pnpm` (`packageManager` pinned in
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

## CI gate

**GitHub Cloud CI is the authoritative gate** (see
[engineering/ci.md](engineering/ci.md)); a PR is mergeable when its GitHub checks
are green. The commands below are an **optional local pre-check** on Node.js 22:

```bash
pnpm install --frozen-lockfile
pnpm --filter @uwe/database db:generate
pnpm lint
pnpm typecheck
pnpm test:ci
pnpm test:security
pnpm build:release
```

The checks target the Linux Host + outbound Maschinenraum path.

## Production (systemd, recommended)

A one-shot setup script detects `/etc/os-release` and provisions Node, dependencies,
the database, `uwe.service`, firewall rules and optional host-update/Maschinenraum
assets:

```bash
sudo bash deploy/scripts/setup-uwe-host.sh            # full
sudo bash deploy/scripts/setup-uwe-host.sh --quick    # update existing host
sudo bash deploy/scripts/uwe-host-status.sh --healthcheck
```

On Fedora, the setup uses `dnf`, the versioned Fedora 44 Node.js 22 packages
(`nodejs22`, `nodejs22-bin`, `nodejs22-npm`, `nodejs22-npm-bin`) and Firewalld.
SELinux stays enabled; the setup reapplies standard contexts instead of weakening
host policy. Enable Firewalld before setup when it is not already running:

```bash
sudo systemctl enable --now firewalld
sudo bash deploy/scripts/setup-uwe-host.sh
```

The main reference unit is `deploy/systemd/uwe.service` (restart limits, pinned Node
path, `EnvironmentFile=-/etc/uwe/uwe.env`). The optional outbound connector unit is
`deploy/systemd/uwe-engine-connector.service`; setup only enables it when its `.env`
contains a real host URL and token. Fedora also installs the DNF5 plugins used for
reboot hints and automatic-update status; automatic updates remain operator-controlled.
Main-service autostart:

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
The host is always the data truth — there is **no** DB replication to the Maschinenraum
machine.

## Behaviour without a Maschinenraum connector

Studio, Portal, login and worlds stay fully online. Connector-backed features use
honest degraded behavior when no online connector advertises the required
effective capability:

- Soundboard local playback needs `audio_local`.
- Spotify controls need `spotify_connect`.
- Local LLM and embedding jobs need reachable Ollama-backed `llm_local` /
  `embedding_local`.
- Image generation needs `image_generation` from an explicitly configured local
  image command.

No crashes — this is the expected degraded state. See
[engine-connector.md](engine-connector.md).
