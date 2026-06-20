# AI Budgeting & Usage Logs

## Budget-Limits

Konfigurierbar im AI Gateway (`/admin/ai-gateway`):

| Limit | Feld |
|-------|------|
| Tagesbudget (global) | `dailyBudgetUsd` |
| Monatsbudget (global) | `monthlyBudgetUsd` |
| User-Tagesbudget (Standard) | `perUserDailyBudgetUsd` |
| User-Tagesbudget (individuell) | `ai_user_grants.dailyBudgetUsd` |

Vor jedem Gateway-Aufruf: `assertBudgetAvailable()`.

## Usage Logs

Tabelle: `ai_usage_logs`

| Feld | Inhalt |
|------|--------|
| `userId` | Ausführender User |
| `feature` | Feature/Kategorie |
| `provider`, `model`, `route` | `local_rtx` oder `cloud` |
| `inputTokens`, `outputTokens` | Optional |
| `estimatedCostUsd` | Schätzung für Cloud (RTX = 0) |
| `success`, `errorMessage` | Ergebnis |
| `durationMs` | Laufzeit |

## Audit

- **Usage logs:** every gateway call → `ai_usage_logs` (no prompt text)
- **Audit log:** Master-Admin config/provider/grant changes → `audit_log` (`targetType: settings`, `targetId: ai-gateway`)
- Master-Admin UI: `/admin/ai-gateway` → Schritt „Test & Logs“

## Kosten-Schätzung

Platzhalter-Raten in `packages/ai-brain/src/gateway/aiGateway.ts` — für Budget-Warnungen, nicht für Abrechnung.

Präzise Kosten: Provider-Dashboards (OpenAI, Anthropic, …).
