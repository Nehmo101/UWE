# AI Permissions

## Rollen

### Master-Admin (`owner`)

- Provider verwalten (`AI_PROVIDER_MANAGE`)
- API-Keys setzen/ersetzen
- Routing-Modus ändern
- Cloud-Fallback global aktivieren/deaktivieren
- Privacy-Regeln ändern (`AI_PRIVACY_MANAGE`)
- Budgets setzen (`AI_BUDGET_MANAGE`)
- User-Freigaben verwalten (`AI_USER_GRANTS_MANAGE`)
- Usage Logs einsehen (`AI_USAGE_VIEW`)
- Fallback-Tests ausführen

Setup: `/admin/ai-gateway` (nur Owner)

### Legacy DM/Admin

`owner`, `admin`, `dm` behalten vollen KI-Zugriff wie bisher (Abwärtskompatibilität).

### AI-freigeschalteter User (z. B. Carina)

Erhält explizite Grants in `ai_user_grants`:

| Permission | Feature |
|------------|---------|
| `AI_CHAT_USE` | Allgemeiner KI-Chat / KI-Prompt |
| `AI_DND_USE` | DnD-Brain, Generator, Wiki-KI |
| `AI_IMAGE_USE` | Image Studio |
| `AI_SUMMARY_USE` | Zusammenfassungen |
| `AI_KNOWLEDGE_USE` | Wissens-Retrieval |

Zusätzlich pro User:

- `cloudFallbackAllowed` — darf Cloud nutzen wenn RTX offline (nur für cloud-safe Kontexte)

### Normaler User / Spieler

- Kein Zugriff auf Provider, Keys oder Admin-UI
- Meldung: „KI ist für diesen Benutzer nicht freigeschaltet.“

## API

- `GET /api/admin/ai-gateway?scope=access` — Zugriffsstatus für eingeloggten User
- `POST /api/admin/ai-gateway?action=user-grant` — Grant setzen (Owner only)

## Code

- `packages/database/src/ai-gateway-service.ts` — `assertFeatureAccess()`, `isCloudFallbackAllowed()`
- `packages/security/src/security/ai-policy.ts` — Legacy-Rollen-Checks
