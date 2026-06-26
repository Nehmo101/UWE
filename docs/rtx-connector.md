# RTX Host Connector

The **RTX Host Connector** is an optional local worker for the RTX PC (Windows or
Linux). It connects **outbound** to the UWE Host, claims jobs from the host queue,
runs them locally where an executor really exists, and reports results.

It is **never required** for UWE to be online.

## Direction of communication

```text
RTX Connector  ----->  UWE Host        (correct: outbound only)
```

The connector **polls** the host. The host never connects to the RTX machine, so
**no public port, SSH or HTTP server** is opened on the RTX side. There is no
public RTX API and no DB replication.

## Setup

1. In Studio open **System -> RTX Connector** and create a connector token. It is
   shown once; only its SHA-256 hash is stored on the host.
2. On the RTX machine (repo checked out, `pnpm install` done):

   ```bash
   cp tools/uwe-rtx-connector/.env.example tools/uwe-rtx-connector/.env
   # set UWE_HOST_URL and UWE_CONNECTOR_TOKEN
   pnpm connector:start
   ```

See `tools/uwe-rtx-connector/.env.example` for all options.

## What works today

- **Heartbeat** with normalized capabilities, discovered models and version.
- **Lane-aware outbound polling**: audio/spotify controls can overtake long GPU
  jobs, while the GPU lane remains concurrency-limited.
- **Soundboard play jobs** via `sound_play` when `UWE_CONNECTOR_AUDIO_CMD` is set.
  The host queues the official `sourceUrl` field; the connector also accepts the
  legacy aliases `url`, `path` and `source`.
- **Ollama-backed local LLM jobs** for `llm_generate` and `embedding_generate`
  when Ollama is reachable and matching models are discovered.
- **Model refresh** through `connector_refresh_models`.
- **Reconnect** after transient host/network errors; **exit** if the token is
  rejected.
- **Graceful shutdown** on SIGINT/SIGTERM (drains active jobs, final heartbeat).

## Stubs and follow-ups

- LM Studio and llama.cpp are still discovered for operator visibility, but they
  do **not** enable `llm_local` or `embedding_local` until an OpenAI-compatible
  executor is added.
- `spotify_*` jobs are in the catalogue, but the connector does not advertise
  `spotify_connect` until a real Spotify executor exists.
- `image_generate` is in the catalogue, but the connector does not advertise
  `image_generation` until a real image executor exists.
- `sound_stop`, `sound_stop_all` and `sound_volume` are control acknowledgements
  in this phase. `sound_play` is the real local audio execution path.

## Capabilities

The host only hands a connector jobs whose required capability the connector
advertises. The connector must not advertise a capability just because a job type
exists.

Advertised today:

| Capability | Advertised when |
|------------|-----------------|
| `audio_local` | `UWE_CONNECTOR_AUDIO_CMD` is configured and audio is not disabled. |
| `llm_local` | A reachable Ollama model reports `chat`. |
| `embedding_local` | A reachable Ollama model reports `embeddings`. |
| `file_cache` | Explicitly enabled and backed by an implementation. |
| `system_info` | Enabled by default for connector maintenance/model refresh. |

Not advertised today unless a real executor is added later:

| Capability | Reason |
|------------|--------|
| `spotify_connect` | Current connector has no Spotify execution backend. |
| `image_generation` | Current connector has no image generation executor. |

`UWE_CONNECTOR_CAPABILITIES` can restrict/force requested entries, but the
connector still filters the result against executable backends so stubs are not
advertised.

## Job lanes & priorities

| Lane | Job types | Priority |
|------|-----------|----------|
| `audio` | `sound_stop*` (100), `sound_play` / `sound_volume` (90) | highest |
| `spotify` | `spotify_*` | 80 |
| `maintenance` | `connector_refresh_models` | 60 |
| `gpu` | `llm_generate` (50), `image_generate` (30), `embedding_generate` (20) | lowest |

## Autostart / tray (later)

Phase 1 runs as a CLI/Node process (`pnpm connector:start`). Running it as an
autostart service or tray app is a follow-up. The legacy `tools/uwe-rtx-agent`
has a Windows tray script for reference, but it is the deprecated inbound model.

## Security

See [connector-security.md](connector-security.md). Host-side
`allowedCapabilities` should be added as a follow-up so the host can store
`reportedCapabilities` separately from effective capabilities and use the
intersection for queue eligibility.
