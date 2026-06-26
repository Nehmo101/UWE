# Local LLM setup (RTX Connector)

The RTX Host Connector discovers local AI providers and reports them to the host.
Discovery is best-effort and offline-safe: a provider that is not running is
reported as `unavailable`, never an error or a crash.

## Supported providers

| Provider | Probe | Default URL | Env override |
|----------|-------|-------------|--------------|
| Ollama | `GET /api/tags` | `http://127.0.0.1:11434` | `OLLAMA_BASE_URL` |
| LM Studio | `GET /v1/models` | `http://127.0.0.1:1234` | `LM_STUDIO_BASE_URL` |
| llama.cpp server | `GET /v1/models` | — | `LLAMACPP_BASE_URL` |

Model capabilities are inferred from the name (`chat`, `vision`, `embeddings`).

## What the host sees

For each connector the host UI (System → RTX Connector) shows:

- which local models are available and from which provider,
- whether the connector advertises `llm_local` / `embedding_local`,
- whether the host queue is active and whether cloud fallback is allowed.

## Capabilities reported

- `llm_local` when at least one chat-capable model is discovered.
- `embedding_local` when an embedding model is discovered.
- `image_generation` only when explicitly enabled (`UWE_CONNECTOR_IMAGE=true`).

You can force capabilities with `UWE_CONNECTOR_CAPABILITIES` (comma-separated) to
skip auto-detection.

## Running jobs

- `llm_generate` → Ollama `/api/chat` (model from the job payload, default
  `llama3.2`).
- `embedding_generate` → Ollama `/api/embeddings` (default `nomic-embed-text`).
- `connector_refresh_models` → re-runs discovery and updates the next heartbeat.

## Privacy

World / brain data is never sent to the cloud automatically. Local models receive
context only via explicit jobs. Cloud fallback stays off unless the host sets
`UWE_AI_CLOUD_FALLBACK=true`. See [connector-security.md](connector-security.md).
