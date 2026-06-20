# AI Privacy & Cloud Fallback

## Grundregeln

1. **Lokale RTX ist Standard** — Cloud nur als explizit freigegebener Fallback
2. **Cloud-Fallback** erfordert Master-Admin-Freigabe (`cloudFallbackEnabled`)
3. **Private Inhalte** gehen standardmäßig **niemals** an Cloud-Provider

## Default-Privacy-Regeln

| Kategorie | Level |
|-----------|-------|
| Allgemeiner Chat | `CLOUD_ALLOWED` |
| DnD-Weltwissen | `CLOUD_FORBIDDEN` |
| Persönliches Brain | `CLOUD_FORBIDDEN` |
| Private Notizen | `CLOUD_FORBIDDEN` |
| Admin-Systemdiagnose | `CLOUD_ALLOWED` |
| Bildfunktionen (ohne private Inhalte) | `CLOUD_ALLOWED` |

Gespeichert in `ai_gateway_config.privacy_rules` (JSON).

## Kontextmodi (bestehend)

`packages/ai-brain/src/router/types.ts`:

- `general_chat` — einziger Modus mit Cloud-Kontext-Erlaubnis
- `brain`, `current_object*`, `personal_brain` — **LOCAL_ONLY**, kein Cloud-Fallback

Zweite Verteidigungslinie: `privacyGuard.ts`, `sanitizeContextForCloud()`.

## User-spezifischer Cloud-Fallback

Selbst wenn global aktiviert, benötigen normale User `cloudFallbackAllowed: true` in ihrem Grant.

DM/Owner/Admin: Cloud-Fallback für erlaubte Kategorien ohne extra Grant.

## RTX offline

| Kontext | Verhalten |
|---------|-----------|
| Lokal-only (Brain, Life Brain) | Job-Queue (HTTP 202), **kein Cloud** |
| General Chat + Fallback erlaubt | Cloud-Provider |
| General Chat + Fallback verboten | Fehlermeldung |

## Deployment

RTX-Agent **nie** hinter Cloudflare Tunnel — siehe `DEPLOYMENT_SECURITY.md`.
