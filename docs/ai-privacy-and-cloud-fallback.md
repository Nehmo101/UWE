# AI Privacy & Cloud Fallback

## W0 Policy (Atlas World Builder — Globale KI-Provider-Policy)

Owner-approved policy change (effective with W0 implementation):
- **Personal Life Brain (`personal_brain`) stays HARD local-only** — never cloud, no fallback, NOT configurable in UI or API.
- **DnD/world context** (`brain`, `current_object`, `current_object_plus_brain`) may go to cloud when admin gateway policy allows (default: `CLOUD_ALLOWED`, RTX preferred).

## Grundregeln

1. **Lokale RTX ist Standard** — Cloud nur als explizit freigegebener Fallback
2. **Cloud-Fallback** erfordert Master-Admin-Freigabe (`cloudFallbackEnabled`)
3. **`personal_brain`** geht **niemals** an Cloud-Provider — hart codiert, nicht konfigurierbar

## Default-Privacy-Regeln

| Kategorie | Level | Änderbar? |
|-----------|-------|-----------|
| Allgemeiner Chat | `CLOUD_ALLOWED` | Ja |
| DnD-Weltwissen | `CLOUD_ALLOWED` | Ja |
| Persönliches Brain | `CLOUD_FORBIDDEN` | **Nein** — permanent lokal |
| Private Notizen | `CLOUD_FORBIDDEN` | Ja |
| Admin-Systemdiagnose | `CLOUD_ALLOWED` | Ja |
| Bildfunktionen (ohne private Inhalte) | `CLOUD_ALLOWED` | Ja |

Gespeichert in `ai_gateway_config.privacy_rules` (JSON). `personal_brain` wird serverseitig immer auf `CLOUD_FORBIDDEN` erzwungen.

## Kontextmodi

`packages/ai-brain/src/router/types.ts`:

| Modus | LOCAL_ONLY | Cloud-Route | Hinweis |
|-------|-----------|-------------|---------|
| `general_chat` | Nein | Ja (immer) | Kein Kontext im Prompt |
| `brain` | **Nein** | Ja (wenn Policy erlaubt) | DnD Brain-Wissen |
| `current_object` | **Nein** | Ja (wenn Policy erlaubt) | Seite/NPC/Ort |
| `current_object_plus_brain` | **Nein** | Ja (wenn Policy erlaubt) | Objekt + Brain |
| `personal_brain` | **Ja** | **Niemals** | Hard-geblockt |

`LOCAL_ONLY_CONTEXT_MODES = ["personal_brain"]` (nur noch Life Brain).

Zweite Verteidigungslinie: `privacyGuard.ts`, `sanitizeContextForCloud()`.

## Prompts bei Cloud-Route

| Kontextmodus | Cloud-Prompt-Inhalt |
|-------------|---------------------|
| `general_chat` | Nur `userPrompt` (kein Kontext) |
| `brain`, `current_object`, `current_object_plus_brain` | Vollständige Task-Prompts mit Kampagnen-Kontext (dm_only gefiltert) |
| `personal_brain` | Wird upstream blockiert, erreicht Cloud nie |

## User-spezifischer Cloud-Fallback

Selbst wenn global aktiviert, benötigen normale User `cloudFallbackAllowed: true` in ihrem Grant.

DM/Owner/Admin: Cloud-Fallback für erlaubte Kategorien ohne extra Grant.

## RTX offline

| Kontext | Verhalten |
|---------|-----------|
| `personal_brain` | Blockiert — kein Cloud-Fallback |
| DnD-Brain (auto-Modus, Policy CLOUD_ALLOWED) | Cloud-Provider als Fallback |
| Explizit `local_rtx` | Fehler — RTX muss online sein |
| General Chat + Fallback erlaubt | Cloud-Provider |
| General Chat + Fallback verboten | Fehlermeldung |

## Deployment

RTX-Agent **nie** hinter Cloudflare Tunnel — siehe `docs/security/DEPLOYMENT_SECURITY.md`.
