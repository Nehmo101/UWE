# AI Budgeting & Usage Logs

## Budget-Limits

Konfigurierbar im AI Gateway (`/admin/ai-gateway`):

| Limit | Feld |
|-------|------|
| Tagesbudget (global) | `dailyBudgetUsd` |
| Monatsbudget (global) | `monthlyBudgetUsd` |
| User-Tagesbudget (Standard) | `perUserDailyBudgetUsd` |
| User-Tagesbudget (individuell) | `ai_user_grants.dailyBudgetUsd` |
| Tages-Tokenbudget (optional, ENV) | `AI_DAILY_TOKEN_BUDGET` — Summe aus `inputTokens` + `outputTokens` in `ai_usage_logs` |

Vor jedem Gateway-Aufruf: `assertBudgetAvailable()`.

## Usage Logs

Tabelle: `ai_usage_logs`

| Feld | Inhalt |
|------|--------|
| `userId` | Ausführender User |
| `feature` | Feature/Kategorie |
| `provider`, `model`, `route` | `local_engine` oder `cloud` |
| `inputTokens`, `outputTokens` | Optional |
| `estimatedCostUsd` | Schätzung für Cloud (Maschinenraum = 0) |
| `success`, `errorMessage` | Ergebnis |
| `durationMs` | Laufzeit |

## Audit

- **Usage logs:** every gateway call → `ai_usage_logs` (no prompt text)
- **Audit log:** Master-Admin config/provider/grant changes → `audit_log` (`targetType: settings`, `targetId: ai-gateway`)
- Master-Admin UI: `/admin/ai-gateway` → Schritt „Test & Logs“

## Kosten-Schätzung

Platzhalter-Raten in `packages/ai-brain/src/gateway/aiGateway.ts` — für Budget-Warnungen, nicht für Abrechnung.

Präzise Kosten: Provider-Dashboards (OpenAI, Anthropic, …).
