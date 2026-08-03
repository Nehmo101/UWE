# UWE AI Gateway

Das **AI Gateway** ist der zentrale Einstiegspunkt für alle KI-Aufrufe in UWE Studio.

## Architektur

```txt
User Prompt
  → UWE AI Gateway (`packages/ai-brain/src/gateway/`)
  → Permission Check (User-Freigaben / Master-Admin)
  → Privacy Check (Kontext-Kategorie)
  → Budget Check (Tages-/Monats-/User-Limits)
  → Maschinenraum-Health Check
  → Local Maschinenraum Provider oder Cloud Provider
  → Usage Log
```

## Routing-Modi

| Modus | Verhalten |
|-------|-----------|
| `LOCAL_ONLY` | Nur Maschinenraum/lokale Inference |
| `LOCAL_THEN_CLOUD` | Historisch — verhält sich seit N.3 wie `LOCAL_ONLY` |
| `CLOUD_ONLY` | Historisch — es gibt keinen Cloud-Anbieter mehr |
| `DISABLED` | KI systemweit aus |

**Standard:** `LOCAL_THEN_CLOUD`. Der Modus entscheidet seit dem Wegfall der
Cloud-Anbieter (N.3) nur noch zwischen „an" und „aus" — die Werte bleiben, weil
sie in der Datenbank stehen; ein Enum-Umbau wäre eine Migration ohne Nutzen.

## Privacy-Level

| Level | Bedeutung |
|-------|-----------|
| `CLOUD_ALLOWED` | Cloud-Fallback erlaubt (wenn global freigegeben) |
| `CLOUD_FORBIDDEN` | Kein Cloud — nur der lokale Maschinenraum |
| `LOCAL_REQUIRED` | Erzwingt lokale Route |

## Code-Platzierung

| Bereich | Pfad |
|---------|------|
| Gateway-Logik | `packages/ai-brain/src/gateway/aiGateway.ts` |
| DB-Services | `packages/database/src/ai-gateway-service.ts` |
| Admin-API | `apps/studio/app/api/admin/ai-gateway/` |
| Cookbook-Wizard | `apps/studio/app/admin/ai-gateway/` |
| Router (bestehend) | `packages/ai-brain/src/router/aiRouter.ts` |

## Integration

| Feature | Gateway | Notes |
|---------|---------|-------|
| KI-Prompt (`/api/ai/prompt`) | ✅ | Requires authenticated user |
| AI generate jobs (`/api/ai/generate`) | ✅ | `job.userId` from session |
| Brain actions (`/api/brain/run`) | ✅ | Permission + usage log when user on job |
| Image Studio | ✅ | `executeAiGatewayImageRequest`, feature `AI_IMAGE_USE` |
| Research jobs | ✅ | `executeAiGatewayResearchJob`, permissions + usage log |
| Deferred KI-Prompt | ✅ | `job.userId` + gateway user on retry |

Implementation: `executeAiGatewayRequest()` in `packages/ai-brain/src/gateway/aiGateway.ts`.

Unit tests without user context may still call `routeAiRequest()` directly.

Developer notes: [engineering/ai-gateway-developer.md](./engineering/ai-gateway-developer.md)

## Siehe auch

- [ai-provider-setup.md](./ai-provider-setup.md)
- [ai-permissions.md](./ai-permissions.md)
- [ai-privacy-and-cloud-fallback.md](./ai-privacy-and-cloud-fallback.md)
- [ai-budgeting-and-usage-logs.md](./ai-budgeting-and-usage-logs.md)
- [ai-troubleshooting.md](./ai-troubleshooting.md)
