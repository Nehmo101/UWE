# UWE RTX Host Connector

Optional **outbound** worker for the RTX PC (Windows or Linux). It connects to
the UWE Host, receives work through the queue, a direct stream, or both, runs it
locally (AI, audio, spotify) and reports results.

The connector is **never required** for UWE to be online. The website, Studio
and Portal run entirely on the host. When the connector is offline, local
AI/audio simply show "RTX Connector offline".

## Direction of communication

```
RTX Connector  ───────▶  UWE Host        (correct: outbound only)
```

The connector either polls the host or opens a persistent outbound
Streaming-HTTP response carrying NDJSON frames. The host never connects to the
RTX machine, so no public port, SSH or HTTP server is opened on the RTX side.

## Quick start

1. In Studio open **System → RTX Connector** and create a connector token.
2. On the RTX machine, with the repo checked out and `pnpm install` run:

   ```bash
   cp tools/uwe-rtx-connector/.env.example tools/uwe-rtx-connector/.env
   # edit .env: set UWE_HOST_URL and UWE_CONNECTOR_TOKEN
   pnpm connector:start
   ```

The connector detects local providers (Ollama / LM Studio / llama.cpp), reports
its capabilities, then receives and runs jobs. Select the transport with
`UWE_CONNECTOR_TRANSPORT=queue|direct|hybrid` (default: `queue`).

## What it does

- Sends a heartbeat with capabilities, models and version.
- `queue`: polls and persists work as `ConnectorJob` rows.
- `direct`: receives NDJSON requests immediately; successful direct requests do
  not create `ConnectorJob` rows.
- `hybrid`: prefers direct and falls back to the queue only before the connector
  reports `accepted`. After acceptance, work is never duplicated in the queue.
- Applies the same **lane** concurrency to queue and direct work, so
  audio/spotify controls can overtake long GPU jobs.
- Reports queue jobs as `complete`/`fail` and direct jobs as
  `accepted`/`result`/`error`.
- Reconnects after transient host/network errors; exits if the token is rejected.
- Shuts down gracefully on SIGINT/SIGTERM (drains active jobs, final heartbeat).

## Desktop client CLI helpers

`src/client-cli.ts` exposes one-shot commands the Tauri desktop client invokes
(`node --import tsx src/client-cli.ts <command>`). In addition to the model-store
helpers it provides runner/cookbook admin commands:

- `cookbook-dashboard` — detected hardware (`@uwe/cookbook`), installed Ollama
  models, curated recommendations and per-model fit scores.
- `probe-runners` — health-check Ollama (`/api/tags`), LM Studio and llama.cpp
  (`/v1/models`).
- `start-ollama` — best-effort start of the local Ollama service on Windows
  and Linux (no-op with a friendly message elsewhere).
- `test-runner [ollama|lm_studio|llama_cpp]` — quick health probe of one runner
  (Ollama also returns a best-effort tokens/s sample).

All probes are offline-safe and only read model metadata the local servers
expose. Runner helpers live in `src/runner-admin.ts`.

When the desktop client starts the connector with **Privacy Mode** enabled it
sets `UWE_CONNECTOR_PRIVACY_MODE=true` (also settable in `.env`; default
`false`). In privacy mode heartbeats carry only what the host needs to route
jobs: model id/provider/name plus their chat/embeddings capabilities, and
printer id/name. Richer host-facing telemetry — model display names,
descriptions, `bestFor` hints, context length, live model status, printer
descriptions and printer state — stays on the connector machine. WHICH
capabilities (`llm_local`, `audio_local`, …) are advertised does not change;
only the metadata richness does.

## Security

- Authenticates with a connector token (`Authorization: Bearer uwec_…`). The
  host stores only the SHA-256 hash.
- Receives only job-specific context — never world, brain, user or admin data.
- No secrets are written to the log stream.

See `docs/rtx-connector.md` and `docs/connector-security.md` for details.
