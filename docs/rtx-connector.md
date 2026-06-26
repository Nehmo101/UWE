# RTX Host Connector

The **RTX Host Connector** is an optional local worker for the RTX PC (Windows or
Linux). It connects **outbound** to the UWE Host, claims jobs from the host queue,
runs them locally (AI, audio, spotify) and reports results.

It is **never required** for UWE to be online.

## Direction of communication

```text
RTX Connector  ───────▶  UWE Host        (correct: outbound only)
```

The connector **polls** the host. The host never connects to the RTX machine, so
**no public port, SSH or HTTP server** is opened on the RTX side. There is no
public RTX API and no DB replication.

## Setup

1. In Studio open **System → RTX Connector** and create a connector token. It is
   shown once; only its SHA-256 hash is stored on the host.
2. On the RTX machine (repo checked out, `pnpm install` done):

   ```bash
   cp tools/uwe-rtx-connector/.env.example tools/uwe-rtx-connector/.env
   # set UWE_HOST_URL and UWE_CONNECTOR_TOKEN
   pnpm connector:start
   ```

See `tools/uwe-rtx-connector/.env.example` for all options.

## What it does

- **Heartbeat** with capabilities, discovered models and version.
- **Capability detection** + local LLM discovery (Ollama / LM Studio / llama.cpp),
  offline-safe (see [local-llm-setup.md](local-llm-setup.md)).
- **Lane-aware polling**: audio/spotify controls overtake long GPU jobs. Only one
  GPU job runs at a time; audio and spotify live in their own lanes.
- **Execute** claimed jobs and report `complete` / `fail`.
- **Reconnect** after transient host/network errors; **exit** if the token is
  rejected.
- **Graceful shutdown** on SIGINT/SIGTERM (drains active jobs, final heartbeat).

## Capabilities

`audio_local`, `spotify_connect`, `llm_local`, `image_generation`,
`embedding_local`, `file_cache`, `system_info`. The host only hands a connector
jobs whose required capability the connector advertises.

## Job lanes & priorities

| Lane | Job types | Priority |
|------|-----------|----------|
| `audio` | `sound_stop*` (100), `sound_play` / `sound_volume` (90) | highest |
| `spotify` | `spotify_*` | 80 |
| `maintenance` | `connector_refresh_models` | 60 |
| `gpu` | `llm_generate` (50), `image_generate` (30), `embedding_generate` (20) | lowest |

## Autostart / tray (later)

Phase 1 runs as a CLI/Node process (`pnpm connector:start`). Running it as an
autostart service or tray app is a follow-up — the legacy `tools/uwe-rtx-agent`
has a Windows tray script for reference, but it is the deprecated inbound model.

## Security

See [connector-security.md](connector-security.md).
