import { Card, CardContent, CardHeader, CardTitle, Input, Label } from "@/src/components/ui";
import type { GatewayDashboard } from "./types";

export function AiGatewayBudgetsTab({
  data,
  patchConfig,
}: {
  data: GatewayDashboard;
  patchConfig: (body: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Budgets</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Heute: ${data.budget.dailySpentUsd.toFixed(4)} /{" "}
          {data.budget.dailyLimitUsd != null ? `$${data.budget.dailyLimitUsd}` : "∞"}
        </p>
        <p className="text-sm text-muted-foreground">
          Monat: ${data.budget.monthlySpentUsd.toFixed(4)} /{" "}
          {data.budget.monthlyLimitUsd != null ? `$${data.budget.monthlyLimitUsd}` : "∞"}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-gateway-budget-daily">Tagesbudget (USD)</Label>
            <Input
              id="ai-gateway-budget-daily"
              type="number"
              step="0.01"
              min="0"
              placeholder="leer = unbegrenzt"
              defaultValue={data.config.dailyBudgetUsd ?? ""}
              onBlur={(e) =>
                void patchConfig({ dailyBudgetUsd: e.target.value ? Number(e.target.value) : null })
              }
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-gateway-budget-monthly">Monatsbudget (USD)</Label>
            <Input
              id="ai-gateway-budget-monthly"
              type="number"
              step="0.01"
              min="0"
              placeholder="leer = unbegrenzt"
              defaultValue={data.config.monthlyBudgetUsd ?? ""}
              onBlur={(e) =>
                void patchConfig({ monthlyBudgetUsd: e.target.value ? Number(e.target.value) : null })
              }
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
