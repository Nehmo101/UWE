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

- **Heartbeat** with normalized, policy-filtered capabilities, discovered models
  and version.
- **Lane-aware outbound polling**: audio/spotify controls can overtake long GPU
  jobs, while the GPU lane remains concurrency-limited.
- **Soundboard play jobs** via `sound_play` when `UWE_CONNECTOR_AUDIO_CMD` is set.
  The host queues the official `sourceUrl` field; the connector also accepts the
  legacy aliases `url`, `path` and `source`.
- **Ollama-backed local LLM jobs** for `llm_generate` and `embedding_generate`
  when Ollama is reachable and matching models are discovered.
- **Spotify Connect control jobs** when both `SPOTIFY_DEVICE_ID` and a Spotify
  access token are configured.
- **Image generation jobs** when `UWE_CONNECTOR_IMAGE_CMD` points at a real local
  image worker. The job payload is sent as JSON on stdin; JSON or text stdout is
  returned as the job result.
- **Model refresh** through `connector_refresh_models`.
- **Reconnect** after transient host/network errors; **exit** if the token is
  rejected.
- **Graceful shutdown** on SIGINT/SIGTERM (drains active jobs, final heartbeat).

## Stubs and follow-ups

- LM Studio and llama.cpp are still discovered for operator visibility, but they
  do **not** enable `llm_local` or `embedding_local`. The executable connector
  path stays Ollama-only for now. Cloud LLM providers belong behind the UWE
  interface/gateway, not behind the RTX connector.
- `sound_stop`, `sound_stop_all` and `sound_volume` are control acknowledgements
  in this phase. `sound_play` is the real local audio execution path.
- `image_generate` has a generic local command executor, but no bundled image
  backend. Packaging a first-party image worker remains a follow-up.

## Capabilities

The host only hands a connector jobs whose required capability is present in that
connector's **effective** capabilities. The connector must not advertise a
capability just because a job type exists.

The host stores capability policy separately:

- `reportedCapabilities`: normalized values from connector heartbeats.
- `allowedCapabilities`: optional host/admin allowlist. `null` means no extra
  restriction; `[]` denies all connector-served capabilities for that connector.
- `capabilities`: effective, job-claimable capabilities used by queue matching.

`effectiveCapabilities = reportedCapabilities` when no allowlist is set;
otherwise the host uses the ordered intersection of reported and allowed values.

Advertised today:

| Capability | Advertised when |
|------------|-----------------|
| `audio_local` | `UWE_CONNECTOR_AUDIO_CMD` is configured and audio is not disabled. |
| `spotify_connect` | `SPOTIFY_DEVICE_ID` plus `SPOTIFY_ACCESS_TOKEN` or `UWE_CONNECTOR_SPOTIFY_ACCESS_TOKEN` is configured and Spotify is not disabled. |
| `llm_local` | A reachable Ollama model reports `chat`. |
| `image_generation` | `UWE_CONNECTOR_IMAGE_CMD` is configured and image jobs are not disabled. |
| `embedding_local` | A reachable Ollama model reports `embeddings`. |
| `file_cache` | Explicitly enabled and backed by an implementation. |
| `system_info` | Enabled by default for connector maintenance/model refresh. |

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

See [connector-security.md](connector-security.md). Unknown capability names are
normalized away, and host/admin `allowedCapabilities` can now cap the effective
capabilities that a connector may use for queue claims.
