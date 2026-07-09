import type { GatewayDashboard } from "./types";

export function AiGatewayBudgetsTab({
  data,
  patchConfig,
}: {
  data: GatewayDashboard;
  patchConfig: (body: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <section className="uwe-v2-card uwe-v2-section">
      <h3>Budgets</h3>
      <p>
        Heute: ${data.budget.dailySpentUsd.toFixed(4)} /{" "}
        {data.budget.dailyLimitUsd != null ? `$${data.budget.dailyLimitUsd}` : "∞"}
      </p>
      <p>
        Monat: ${data.budget.monthlySpentUsd.toFixed(4)} /{" "}
        {data.budget.monthlyLimitUsd != null ? `$${data.budget.monthlyLimitUsd}` : "∞"}
      </p>
      <div className="uwe-form-grid">
        <label className="uwe-field">
          Tagesbudget (USD)
          <input
            className="uwe-input"
            type="number"
            step="0.01"
            min="0"
            placeholder="leer = unbegrenzt"
            defaultValue={data.config.dailyBudgetUsd ?? ""}
            onBlur={(e) =>
              void patchConfig({ dailyBudgetUsd: e.target.value ? Number(e.target.value) : null })
            }
          />
        </label>
        <label className="uwe-field">
          Monatsbudget (USD)
          <input
            className="uwe-input"
            type="number"
            step="0.01"
            min="0"
            placeholder="leer = unbegrenzt"
            defaultValue={data.config.monthlyBudgetUsd ?? ""}
            onBlur={(e) =>
              void patchConfig({ monthlyBudgetUsd: e.target.value ? Number(e.target.value) : null })
            }
          />
        </label>
      </div>
    </section>
  );
}
