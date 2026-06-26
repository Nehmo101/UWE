# UWE RTX Host Connector

Optional **outbound** worker for the RTX PC (Windows or Linux). It connects to
the UWE Host, claims jobs from the host queue, runs them locally (AI, audio,
spotify) and reports results.

The connector is **never required** for UWE to be online. The website, Studio
and Portal run entirely on the host. When the connector is offline, local
AI/audio simply show "RTX Connector offline".

## Direction of communication

```
RTX Connector  ───────▶  UWE Host        (correct: outbound only)
```

The connector **polls** the host. The host never connects to the RTX machine,
so no public port, SSH or HTTP server is opened on the RTX side.

## Quick start

1. In Studio open **System → RTX Connector** and create a connector token.
2. On the RTX machine, with the repo checked out and `pnpm install` run:

   ```bash
   cp tools/uwe-rtx-connector/.env.example tools/uwe-rtx-connector/.env
   # edit .env: set UWE_HOST_URL and UWE_CONNECTOR_TOKEN
   pnpm connector:start
   ```

The connector detects local providers (Ollama / LM Studio / llama.cpp), reports
its capabilities, then claims and runs jobs.

## What it does

- Sends a heartbeat with capabilities, models and version.
- Polls for jobs by **lane** so audio/spotify controls overtake long GPU jobs
  (only one GPU job runs at a time).
- Executes jobs and reports `complete` / `fail`.
- Reconnects after transient host/network errors; exits if the token is rejected.
- Shuts down gracefully on SIGINT/SIGTERM (drains active jobs, final heartbeat).

## Security

- Authenticates with a connector token (`Authorization: Bearer uwec_…`). The
  host stores only the SHA-256 hash.
- Receives only job-specific context — never world, brain, user or admin data.
- No secrets are written to the log stream.

See `docs/rtx-connector.md` and `docs/connector-security.md` for details.
