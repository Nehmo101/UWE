# AI Provider Setup

Cloud-Provider und RTX werden **ausschließlich vom Master-Admin (Owner)** konfiguriert.

## Lokale RTX (bevorzugt)

Aktiver Weg: direktes Ollama/LM Studio im Heimnetz plus optional der ausgehende
**RTX Host Connector** (`tools/uwe-rtx-connector`, `pnpm connector:start`).

```env
AI_INFERENCE_ENABLED=true
AI_INFERENCE_PROVIDER=ollama
AI_INFERENCE_BASE_URL=http://192.168.x.x:11434
PREFERRED_LOCAL_MODEL=llama3.2
```

Nur im Heimnetz, nie öffentlich. Siehe [rtx-connector.md](rtx-connector.md).

> **Legacy (entfernt):** der alte inbound RTX-Agent (Tool + ai-brain-LLM-Client) wurde
> entfernt. `RTX_AGENT_URL` / `RTX_AGENT_TOKEN` überleben nur als Legacy-Aliase der
> RTX-Worker-URL (`RTX_BASE_URL` / `RTX_SERVICE_TOKEN`) für den Worker/Image-Pfad
> ([removed-legacy-runtime.md](removed-legacy-runtime.md)).

## Cloud-Provider (Fallback)

API-Keys werden **verschlüsselt in der Datenbank** gespeichert (`ai_cloud_providers.api_key_enc`), nicht in `.env` (ENV-Keys funktionieren weiterhin als Fallback).

### Unterstützte Provider

| Provider-ID | Beispiel-Modell |
|-------------|-----------------|
| `openai` | `gpt-4o-mini` |
| `anthropic` | `claude-3-5-haiku-latest` |
| `gemini` | `gemini-2.0-flash` |
| `openrouter` | `mistralai/mistral-small` |
| `openai_compatible` | Beliebiger OpenAI-kompatibler Endpoint |

### ENV-Fallback (optional)

```env
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
OPENROUTER_API_KEY=
CLOUD_AI_PROVIDER=openai
CLOUD_AI_MODEL=gpt-4o-mini
```

## Master-Admin Setup

1. Studio → **Cookbook** → **KI & RTX Fallback** (`/admin/ai-gateway`)
2. RTX Health-Check prüfen
3. Routing-Modus wählen
4. Cloud-Fallback aktivieren (optional)
5. Provider + API-Key setzen
6. Fallback-Test ausführen

## Neuer OpenAI-kompatibler Provider

1. Provider in Admin-UI anlegen oder `AiGatewayService.upsertCloudProvider()` nutzen
2. Bei Bedarf Adapter in `packages/ai-brain/src/providers/openai-family.ts` erweitern
3. Registry: `packages/ai-brain/src/providers/registry.ts`

**Secrets niemals** an den Client senden oder loggen.
