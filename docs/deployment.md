# Deployment

UWE deploys as a single **Linux Host** plus an optional **Maschinenraum**.
There is no Docker image and no Windows installer in the active product path
(see [removed-legacy-runtime.md](removed-legacy-runtime.md)).

## Target topology

```text
Internet ──(Cloudflare Tunnel, optional)── UWE Host (Linux, always-on)
                                              ├── Studio  :3000
                                              ├── Portal  :3001
                                              ├── SQLite/Postgres (source of truth)
                                              └── Job queue + worker registry
                                                    ▲
                                                    │ outbound only
                                          Maschinenraum (optional)
                                              └── local AI / audio / spotify
```

## Host deployment

1. Provision the Linux host: `sudo bash deploy/scripts/setup-uwe-host.sh`.
2. Configure `/etc/uwe/uwe.env` (or repo `.env`): `SESSION_SECRET`,
   `PUBLIC_BASE_URL`, `TRUST_PROXY`, `UWE_RUNTIME_ROLE=host`.
3. Enable autostart: `sudo systemctl enable --now uwe.service`.
4. Public access via Cloudflare Tunnel (no inbound ports). See
   [cloudflare-access.md](cloudflare-access.md) and
   [deployment-hardening.md](deployment-hardening.md).

Full detail: [host-linux.md](host-linux.md).

## Updates

```bash
git pull
pnpm install --frozen-lockfile
pnpm --filter @uwe/database db:deploy
pnpm build:release
sudo systemctl restart uwe.service
# or: sudo bash deploy/scripts/setup-uwe-host.sh --quick
```

## Maschinenraum deployment

Optional and independent of the host lifecycle. Create a token in Studio, fill
`tools/uwe-engine-connector/.env`, run `pnpm connector:start`. The connector can come
and go freely; the host stays online. See [engine-connector.md](engine-connector.md).

## Backups

`pnpm backup:create` (`@uwe/backup`) and `deploy/scripts/uwe-backup.sh` +
`deploy/systemd/uwe-backup.timer`. See [BACKUP.md](BACKUP.md).

## CI gates before deploy

`pnpm quality` (lint, secret scan, typecheck, unit + security tests, prod audit,
release build, bundle budget). See [engineering/ci.md](engineering/ci.md).
