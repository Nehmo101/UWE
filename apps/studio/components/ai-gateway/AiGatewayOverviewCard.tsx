import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui";
import { ROUTING_LABELS } from "./constants";
import type { GatewayDashboard } from "./types";

export function AiGatewayOverviewCard({ data }: { data: GatewayDashboard }) {
  const { config, engineHealth } = data;
  const engineLabel = engineHealth.ready ? "Erreichbar" : "Nicht erreichbar";

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
            Maschinenraum: <strong>{engineLabel}</strong>
            {" · "}
            <span>Connector: Kommandozentrale</span>
          </p>
        </div>
        {engineHealth.message && <p className="text-sm text-muted-foreground">{engineHealth.message}</p>}
      </CardContent>
    </Card>
  );
}
