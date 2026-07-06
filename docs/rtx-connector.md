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

For the Windows desktop client use:

```bash
pnpm connector:client:dev
pnpm connector:client:build
```

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
- **Privacy mode** via `UWE_CONNECTOR_PRIVACY_MODE` (default off, toggled from the
  desktop client's SecurityPanel): heartbeats send only minimal model metadata
  (model ids, provider, capabilities) and omit display names, descriptions,
  best-for hints, context length and local paths.
- **Hugging Face file downloads** in the Windows desktop client. Downloaded files
  are stored under the connector client data directory and registered as local
  `huggingface` model profiles. Private/gated repos use `HF_TOKEN` or
  `HUGGINGFACE_HUB_TOKEN` from the RTX machine environment.
- **Windows tray and autostart** in the desktop client. The tray can re-open or
  exit the app; `start_in_tray` / `minimize_to_tray` hide the window as configured;
  Windows autostart is written to the current user's Run key.
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
- `file_cache` exists only as a protocol capability constant. There is no
  `file_cache` job type or executor behind it, so it should stay disabled until
  an implementation lands.
- Tauri Windows bundling is enabled for MSI/NSIS. The checked-in SVG is the source
  icon; generate `.ico`/PNG sizes in a local checkout if the active Tauri bundler
  requires platform-specific icon binaries.

## Capabilities

The host only hands a connector jobs whose required capability is present in that
connector's **effective** capabilities. The connector must not advertise a
capability just because a job type exists.

The host stores capability policy separately:

- `reportedCapabilities`: normalized values from connector heartbeats.
- `allowedCapabilities`: optional host/admin allowlist. `null` means no extra
  restriction; `[]` denies all connector-served capabilities for that connector.
- `capabilities`: effective, job-claimable capabilities used by queue matching.

Owner/admin UI: **Studio → System → RTX Connector** — per-connector „Host-Freigabe“
(`ConnectorCapabilityGovernance`). API: `PATCH /api/admin/connectors/[id]` with
`action: "set-allowed-capabilities"`.

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
| `file_cache` | Never in practice — the name is protocol-reserved, but no `file_cache` job type or executor exists yet. Keep it disabled. |
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

## Label printing (CUPS / local printers)

The connector supports local label printing via the `label_printing` capability.
When a Studio user sends a label to a connected printer, the host queues a
`label_print` job; the connector fetches the rendered document (PDF or HTML)
and forwards it to the local print backend.

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `UWE_CONNECTOR_PRINTERS` | no | JSON array of available printers. If empty the connector runs `lpstat -p` (CUPS) for auto-discovery. |
| `UWE_CONNECTOR_PRINT_CMD` | no | Custom print command. Receives `--printer <id> --file <path>` appended. Default: CUPS `lp -d <id> <file>`. |
| `UWE_CONNECTOR_PRINT` | no | Master switch (`true`/`false`, default `true`). Set `false` to disable label_printing entirely. |

### UWE_CONNECTOR_PRINTERS format

```json
[{"id": "zebra-lp2844", "name": "Zebra LP 2844 Label"}]
```

- `id` — printer identifier passed to CUPS / custom command.
- `name` — human-readable label shown in Studio printer selection.

If unset, the connector auto-discovers printers via `lpstat -p` (CUPS).
If CUPS is not installed and no `UWE_CONNECTOR_PRINTERS` is set,
`label_printing` is **not advertised** and label jobs are not claimed.

### UWE_CONNECTOR_PRINT_CMD

Set this when you need a custom print pipeline instead of bare CUPS `lp`:

```bash
<UWE_CONNECTOR_PRINT_CMD> --printer <id> --file <path/to/doc.pdf>
```

### CUPS integration (Linux / macOS)

1. Install CUPS: `sudo apt install cups` (Debian/Ubuntu).
2. Add the printer via the CUPS web UI (`http://localhost:631`) or `lpadmin`.
3. Verify with `lpstat -p` — the connector will auto-discover from there.

### CUPS integration (Windows)

Windows does not ship CUPS. Set `UWE_CONNECTOR_PRINT_CMD` pointing to a
script that calls the Windows print spooler.

In the desktop client, the **Drucker** sidebar area shows configured printers
and the active print command.

### Example `.env` snippet

```bash
# Single label printer (Zebra LP 2844 via CUPS):
UWE_CONNECTOR_PRINTERS=[{"id":"zebra-lp2844","name":"Zebra LP 2844 Label"}]

# Custom print command (optional):
# UWE_CONNECTOR_PRINT_CMD=lpr -P

# Disable label printing:
# UWE_CONNECTOR_PRINT=false
```

## Manual QA — label printing

GitHub CI has no CUPS printer or RTX connector hardware. Unit tests cover
`label-print-queue-service` and connector capability detection; the Studio
`/system/printers` UI is smoke-tested in `e2e/studio-label-print.spec.ts`.

Run this checklist on a homelab with UWE Host + RTX connector before relying on
physical label output:

1. **Connector env** — copy `tools/uwe-rtx-connector/.env.example` to `.env` and set:
   - `UWE_CONNECTOR_TOKEN` (from Studio → System → RTX Connector)
   - `UWE_CONNECTOR_PRINTERS` or install CUPS and verify `lpstat -p`
   - optional `UWE_CONNECTOR_PRINT_CMD` for Windows/custom spoolers
2. **Start connector** — `pnpm connector:start` (or desktop client); confirm heartbeat in Studio.
3. **Discover printers** — Studio → System → Drucker → **Suchen**; expect at least one printer row.
4. **Queue smoke** — enqueue a label from a world Labels/Print flow; `/system/printers` queue shows the job.
5. **Physical print** — job reaches `completed`; label exits the configured printer.

Optional Playwright homelab run (skipped in CI by default):

```bash
UWE_E2E_LABEL_PRINT=1 pnpm test:e2e e2e/studio-label-print.spec.ts
```

CI stubs for `UWE_CONNECTOR_PRINT_CMD` remain a follow-up; until then use the
checklist above instead of expecting green physical-print E2E in GitHub Cloud.

## Security

See [connector-security.md](connector-security.md). Unknown capability names are
normalized away, and host/admin `allowedCapabilities` can now cap the effective
capabilities that a connector may use for queue claims.
