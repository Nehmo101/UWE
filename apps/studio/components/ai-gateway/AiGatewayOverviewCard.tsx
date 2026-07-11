import Link from "next/link";
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
            Routing: <strong>{ROUTING_LABELS[config.routingMode]}</strong>
            {config.routingMode === "LOCAL_THEN_CLOUD" && (
              <span className="text-sm text-muted-foreground"> · empfohlen</span>
            )}
          </p>
          <p className="text-base font-semibold">
            RTX: <strong>{rtxLabel}</strong>
            {" · "}
            <Link href="/system/rtx-connector">Connector</Link>
          </p>
          <p className="col-span-2 text-base font-semibold">
            Cloud-Fallback: <strong>{config.cloudFallbackEnabled ? "Ja" : "Nein"}</strong>
          </p>
        </div>
        {rtxHealth.message && <p className="text-sm text-muted-foreground">{rtxHealth.message}</p>}
      </CardContent>
    </Card>
  );
}
