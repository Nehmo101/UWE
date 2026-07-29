# UWE Maschinenraum (Engine Room)

The **Maschinenraum** is an optional local worker for the machine that has the
hardware — usually the RTX PC (Windows or Linux). It connects **outbound** to the
UWE Host, receives queue or direct work, runs it locally where an executor really
exists, and reports results.

It is **never required** for UWE to be online.

## Naming

Formerly **„RTX Host Connector" / „RTX Connector"**. The name was renamed in
2026-07 because it describes far more than a GPU: local LLMs and embeddings,
document OCR, image generation, audio playback, Spotify control, dictation and
label printing. „RTX" is an NVIDIA brand and none of the non-GPU executors need
one. The Command Center is the bridge; the Maschinenraum is where the work
happens.

Renamed is the **product name only**. Everything a running installation depends
on is deliberately unchanged, so no host, token or config migration is needed:

| Frozen | Value |
|---|---|
| Repository paths | `tools/uwe-rtx-connector`, `apps/rtx-connector-client` |
| Package names | `@uwe/rtx-connector-client`, `@uwe/connector-client-config` |
| Environment variables | `UWE_CONNECTOR_*`, `UWE_HOST_URL` |
| Token prefix | `uwec_…` |
| systemd unit | `uwe-rtx-connector.service` |
| Windows AppData root | `%LOCALAPPDATA%\UWE\rtx-connector-client` |
| Release assets | `UWE_Command_Center_<version>_x64-setup.exe` |

In the UI the surface is called **Maschinenraum** (Command Center → sidebar).
The token field stays labelled „Connector-Token" because it maps 1:1 to
`UWE_CONNECTOR_TOKEN`.

## Direction of communication

```text
Maschinenraum  ----->  UWE Host        (correct: outbound only)
```

The connector either polls the host or holds an outbound Streaming-HTTP response
whose frames are NDJSON. The host never connects to the RTX machine, so **no
public port, SSH or HTTP server** is opened on the RTX side. There is no public
RTX API and no DB replication.

## Setup

1. In the Command Center open **Maschinenraum** and create a connector token. It is
   shown once; only its SHA-256 hash is stored on the host.
2. On the RTX machine (repo checked out, `pnpm install` done):

   ```bash
   cp tools/uwe-rtx-connector/.env.example tools/uwe-rtx-connector/.env
   # set UWE_HOST_URL and UWE_CONNECTOR_TOKEN
   pnpm connector:start
   ```

See `tools/uwe-rtx-connector/.env.example` for all options. Transport is
selected with `UWE_CONNECTOR_TRANSPORT=queue|direct|hybrid`. On a production
Linux host, `setup-uwe-host.sh` also installs `uwe-rtx-connector.service`; it is only
enabled after the copied `.env` contains a real host URL and connector token.
The system unit is intended for headless workloads such as Ollama over HTTP, image
workers and printing. Audio executors that depend on a logged-in PipeWire session
should run as that desktop user instead. A worker that opens GPU device nodes directly
may also require the `uwe` user in the host's `video`/`render` groups; Ollama's
own service does not require that for the connector itself.

Für das UWE Command Center auf Windows:

```bash
pnpm command-center:dev
pnpm command-center:build
```

## Transport modes

| Mode | Delivery | Persistence and fallback |
|---|---|---|
| `queue` | Connector polls and claims by available lane. | Work is stored as a `ConnectorJob`. |
| `direct` | Host writes request frames to the connector's outbound NDJSON stream. | No `ConnectorJob` row is created. If no direct session is available, the request fails. |
| `hybrid` | Direct is attempted first. | Queue fallback is allowed only before the connector sends `accepted`; accepted work is never enqueued again. |

Both transports use the same capability policy and lane concurrency. The host
stream endpoint is `GET /api/connectors/direct/stream`; connector events
(`accepted`, `progress`, `result`, `error`) use
`POST /api/connectors/direct/events`, authenticated with the same bearer token.

The direct registry is process-local. Production therefore runs one Studio
process for this transport. Multiple Studio processes would require a shared
broker/session registry (or equivalent connection affinity) before direct
dispatch can safely be distributed.

## What works today

- **Heartbeat** with normalized, policy-filtered capabilities, discovered models
  and version.
- **Lane-aware queue and direct delivery**: audio/spotify controls can overtake
  long GPU jobs, while the GPU lane remains concurrency-limited.
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
- **Speech-to-text jobs** (`audio_transcribe`) when `UWE_CONNECTOR_STT_CMD` points
  at a local speech engine. UWE ships no engine on purpose — Ollama has no audio
  endpoint, and pinning one Python/whisper stack would add a manual host step.
  The contract is JSON on stdin, JSON on stdout:
  `{"audioPath","mimeType","language","model"}` in, `{"text","model"}` out. The
  audio arrives as a temp file (0600, deleted afterwards) because every speech
  CLI expects a path. Reference wrapper for whisper.cpp:
  `deploy/scripts/uwe-stt-whisper.sh`; set the command in the UWE Command Center
  under "Lokale Spracherkennung". Used by the Brain KI-Chat for dictation.
- **Model refresh** through `connector_refresh_models`.
- **Privacy mode** via `UWE_CONNECTOR_PRIVACY_MODE` (default off, toggled from the
  desktop client's SecurityPanel): heartbeats send only minimal model metadata
  (model ids, provider, capabilities) and omit display names, descriptions,
  best-for hints, context length and local paths.
- **Hugging Face file downloads** im UWE Command Center. Downloaded files
  are stored under the connector client data directory and registered as local
  `huggingface` model profiles. Private/gated repos use `HF_TOKEN` or
  `HUGGINGFACE_HUB_TOKEN` from the RTX machine environment.
- **Windows tray and autostart** im UWE Command Center. The tray can re-open or
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

Owner/admin UI: **Command Center → Maschinenraum** — per-connector „Host-Freigabe“
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
| `vision_local` | A reachable, UWE-enabled model is vision-capable — either Ollama reports the `vision` capability, or the model name matches a known family (`unlimited-ocr`, `deepseek-ocr`, `llava`, `minicpm-v`, `qwen2.5-vl`, `moondream`, `bakllava`, `llama3.2-vision`). |
| `stt_local` | `UWE_CONNECTOR_STT_CMD` is configured and `UWE_CONNECTOR_STT` is not `false`. |
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
| `gpu` | `llm_generate` (50), `audio_transcribe` (45), `vision_extract` (40), `image_generate` (30), `embedding_generate` (20) | lowest |

## Label printing (CUPS / local printers)

The connector supports local label printing via the `label_printing` capability.
When a Studio user sends a label to a connected printer, the host queues a
`label_print` job; the connector fetches the rendered document (PDF or HTML)
and forwards it to the local print backend.

Label printing and printer discovery currently require `queue` or `hybrid`
mode. A Direct-only connector is deliberately not offered as a print target:
the protected document download and print progress are tied to the persisted
`ConnectorJob`. Native Direct printing remains a follow-up.

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

1. Install CUPS: `sudo apt install cups` (Debian/Ubuntu) or
   `sudo dnf install cups` (Fedora).
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
   - `UWE_CONNECTOR_TOKEN` (from Command Center → Maschinenraum)
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

## Document OCR (Unlimited-OCR)

Most `vision_extract` work in UWE is document parsing — the PDF→campaign import
and the Family scan inbox — not general image description. Both send
[baidu/Unlimited-OCR](https://github.com/baidu/Unlimited-OCR) (MIT) as the
`model` in the job payload, so the connector needs it locally:

```bash
ollama pull frob/unlimited-ocr:q8_0    # ~4 GB, 32K context, text + image
```

Requires an Ollama built on llama.cpp **build 168 (2026-07-01) or newer** — the
architecture was mainlined in PR #24969. Older builds fail to load the model.

The model is chosen through the existing **`vision` workflow slot** (Command
Center → Modelle), so it is configurable from UWE with no extra host step. With
no slot default set, `UNLIMITED_OCR_MODEL` applies. A generic vision model in
that slot still works, but the campaign import preview will note that layout
fidelity is reduced.

Prompts come from `@uwe/pdf-ocr` (`buildOcrPrompt`): Unlimited-OCR gets the
prompt it was trained on (`<image>document parsing.`), anything else gets a
plain-language instruction instead — the `<image>` token would only confuse it.
