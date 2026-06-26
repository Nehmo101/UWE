# UWE RTX Agent (DEPRECATED — inbound model)

> **Deprecated.** This is the legacy **inbound** model: the agent runs an HTTP
> server on the RTX machine and the UWE Host calls into it (`RTX_AGENT_URL`). The
> go-forward path is the **outbound** RTX Host Connector in
> `tools/uwe-rtx-connector` (`pnpm connector:start`), which opens no port on the
> RTX machine and connects outbound to the host. See `docs/rtx-connector.md`.
> Kept only for existing setups; not part of the active product path.

Local inference proxy for the RTX machine. The agent runs on the GPU PC, checks or starts Ollama, exposes a small HTTP API for UWE, and never stores Brain data or logs prompts by default.

## Role

This service is part of the UWE orchestrator system:

- Runs locally on the RTX machine
- Proxies `/chat` to Ollama (or compatible local backend)
- Protects access with a shared token
- Exposes `/health` for UWE status checks

UWE remains the data owner. The RTX agent is inference-only.

## Requirements

- Node.js 20+
- pnpm (from the UWE monorepo)
- Ollama installed locally (recommended)

## Quick start

From the UWE repository root:

```powershell
cd tools/uwe-rtx-agent
copy .env.example .env
# Edit .env — set AGENT_TOKEN to a long random string
pnpm install
pnpm build
pnpm start
```

Or from the repo root:

```powershell
pnpm --filter @uwe/rtx-agent build
pnpm --filter @uwe/rtx-agent start
pnpm --filter @uwe/rtx-agent tray
```

The agent listens on `http://127.0.0.1:8787` by default.

## Windows Tray (recommended)

Build once, configure `.env`, then start the tray UI:

```powershell
pnpm --filter @uwe/rtx-agent build
pnpm --filter @uwe/rtx-agent tray
```

The tray app:

- starts the agent in the background if needed
- shows status (ready / starting / error / disabled)
- lets you activate/deactivate the agent with one click
- can restart the local AI backend
- manages autostart via CurrentUser registry (`HKCU\...\Run`)
- opens logs and configuration

Autostart can also be enabled from the CLI:

```powershell
pnpm --filter @uwe/rtx-agent exec node dist/index.js enable-autostart
```

Logs and persisted state live under `%LOCALAPPDATA%\UWE-RTX-Agent\`.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENT_HOST` | `127.0.0.1` | Bind address (prefer localhost or private LAN IP) |
| `AGENT_PORT` | `8787` | HTTP port |
| `AGENT_TOKEN` | — | Required shared secret for `/chat` |
| `AGENT_ENABLED` | `true` | `false` disables the agent |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Ollama API base URL |
| `DEFAULT_MODEL` | `llama3.2` | Fallback model name |
| `START_OLLAMA_COMMAND` | — | Optional command to start Ollama when offline |
| `REQUEST_TIMEOUT_SECONDS` | `120` | Upstream and startup timeout |
| `ALLOWED_ORIGINS` | Studio defaults | Comma-separated CORS origins |
| `LOG_PROMPTS` | `false` | Set `true` only for local debugging |

## HTTP API

### `GET /health`

Requires token via `Authorization: Bearer <AGENT_TOKEN>` or `X-Agent-Token`.

Returns HTTP `503` when `status` is `error`, otherwise `200`.

Ready:

```json
{
  "status": "ready",
  "enabled": true,
  "backend": "ollama",
  "model": "llama3.2",
  "gpu": "rtx",
  "message": "Lokale KI bereit"
}
```

Tray UI also exposes `GET /api/status` (token required) with URL, backend, model, autostart, and last healthcheck timestamp.

Control endpoints (token required):

- `POST /api/control/enable`
- `POST /api/control/disable`
- `POST /api/control/restart-backend`
- `GET|POST /api/control/autostart`

Disabled:

```json
{
  "status": "disabled",
  "enabled": false,
  "message": "RTX Agent disabled by user"
}
```

Starting:

```json
{
  "status": "starting",
  "enabled": true,
  "message": "Local AI backend is starting"
}
```

Error:

```json
{
  "status": "error",
  "enabled": true,
  "message": "Ollama not reachable"
}
```

### `POST /chat`

Requires token via `Authorization: Bearer <AGENT_TOKEN>` or `X-Agent-Token: <AGENT_TOKEN>`.

Request:

```json
{
  "messages": [
    { "role": "user", "content": "Hello" }
  ],
  "model": "llama3.2",
  "options": {}
}
```

Response: Ollama chat payload (`message`, `model`, `done`).

Blocked cases:

- Agent disabled → `403`
- Missing/invalid token → `401`
- Ollama offline → `503`

## Connect UWE

Point UWE inference settings at the agent instead of raw Ollama, for example:

```env
AI_INFERENCE_BASE_URL=http://192.168.x.x:8787
AI_INFERENCE_API_KEY=<same-as-AGENT_TOKEN>
```

Use a private LAN IP if UWE runs on another machine in the same network.

## Security notes

- Do not expose the agent publicly on the internet
- Prefer `127.0.0.1` or a private LAN address for `AGENT_HOST`
- Use a strong random `AGENT_TOKEN`
- Prompts are not logged unless `LOG_PROMPTS=true`
- No Brain data is stored by this service

## Development

```powershell
pnpm --filter @uwe/rtx-agent typecheck
pnpm --filter @uwe/rtx-agent test
```

Tests use a local mock Ollama server — no real GPU or Ollama instance required.

## Optional: auto-start Ollama

If Ollama is installed but not running as a service:

```env
START_OLLAMA_COMMAND=ollama serve
```

The agent will attempt to start Ollama once when the backend is offline, then poll until ready or timeout.
