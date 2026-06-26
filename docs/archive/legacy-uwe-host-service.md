# Archived: legacy `uwe-host.service` unit

> **Status: archived / deprecated.** This is a historical record only. The
> active Linux production path is `deploy/systemd/uwe.service`, installed via
> `sudo bash deploy/scripts/setup-uwe-host.sh`. Do **not** install the unit
> below.

The `uwe-host.service` unit was used by the early home-host flow (repo-local
`.env`, `.uwe-host` state dir, `scripts/uwe-host-run.sh`). It was superseded by
`uwe.service` + `/etc/uwe/uwe.env` + `/var/lib/uwe`, which is the single,
hardened systemd unit UWE ships today.

`deploy/scripts/setup-uwe-host.sh` automatically stops and removes any leftover
`uwe-host.service` when it installs `uwe.service`, so existing home-host setups
migrate without manual steps.

## Original template (do not use for new installs)

```ini
# DEPRECATED — use uwe.service instead
#
# This unit file was used by the legacy home-host flow (repo-local .env, .uwe-host state).
# The official Linux production flow is:
#
#   sudo bash /opt/uwe/deploy/scripts/setup-uwe-host.sh
#
# That installs uwe.service with /etc/uwe/uwe.env and /var/lib/uwe.
# Do NOT install uwe-host.service alongside uwe.service — only one service should run.
#
# Migration: run setup-uwe-host.sh — it stops and removes uwe-host.service automatically.

[Unit]
Description=DEPRECATED — UWE Home Host (use uwe.service)
Documentation=file://@UWE_HOME@/docs/UWE_HOST_LINUX_STARTUP.md
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=@UWE_USER@
Group=@UWE_GROUP@
WorkingDirectory=@UWE_HOME@
Environment=UWE_HOME=@UWE_HOME@
Environment=NODE_ENV=production
Environment=HOST_BIND=0.0.0.0
EnvironmentFile=-@UWE_HOME@/.env
EnvironmentFile=-@UWE_HOME@/.env.local

ExecStart=@UWE_HOME@/scripts/uwe-host-run.sh

Restart=on-failure
RestartSec=10
TimeoutStopSec=30

StandardOutput=journal
StandardError=journal
SyslogIdentifier=uwe-host

[Install]
WantedBy=multi-user.target
```

## Active replacement

- Unit: [`deploy/systemd/uwe.service`](../../deploy/systemd/uwe.service)
- Installer: [`deploy/scripts/setup-uwe-host.sh`](../../deploy/scripts/setup-uwe-host.sh)
- Docs: [`docs/UWE_HOST_LINUX_STARTUP.md`](../UWE_HOST_LINUX_STARTUP.md)
