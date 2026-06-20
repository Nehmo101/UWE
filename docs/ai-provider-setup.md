# AI Provider Setup

Cloud-Provider und RTX werden **ausschließlich vom Master-Admin (Owner)** konfiguriert.

## Lokale RTX (bevorzugt)

```env
RTX_AGENT_URL=http://192.168.x.x:8787
RTX_AGENT_TOKEN=<starkes-geheimnis>
PREFERRED_LOCAL_MODEL=llama3.2
```

RTX-Agent: `tools/uwe-rtx-agent/` — nur im Heimnetz, nie öffentlich.

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
