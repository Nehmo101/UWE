import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui";
import { ROUTING_LABELS } from "./constants";
import type { GatewayDashboard } from "./types";

export function AiGatewayOverviewCard({ data }: { data: GatewayDashboard }) {
  const { config, rtxHealth } = data;
  const rtxLabel = rtxHealth.ready ? "Erreichbar" : "Nicht erreichbar";

  return (
    <Card aria-label="KI-Gateway Übersicht">
      <CardHeader>
        <CardTitle>Übersicht</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <p className="text-base font-semibold">
            Status: <strong>{ROUTING_LABELS[config.routingMode]}</strong>
          </p>
          <p className="text-base font-semibold">
            RTX: <strong>{rtxLabel}</strong>
            {" · "}
            <span>Connector: Kommandozentrale</span>
          </p>
        </div>
        {rtxHealth.message && <p className="text-sm text-muted-foreground">{rtxHealth.message}</p>}
      </CardContent>
    </Card>
  );
}
