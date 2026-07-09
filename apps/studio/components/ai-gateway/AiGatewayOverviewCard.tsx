import Link from "next/link";
import { ROUTING_LABELS } from "./constants";
import type { GatewayDashboard } from "./types";

export function AiGatewayOverviewCard({ data }: { data: GatewayDashboard }) {
  const { config, rtxHealth } = data;
  const rtxLabel = rtxHealth.ready ? "Erreichbar" : "Nicht erreichbar";

  return (
    <section className="uwe-v2-card uwe-v2-section" aria-label="KI-Gateway Übersicht">
      <h2 className="uwe-v2-section-title">Übersicht</h2>
      <div className="uwe-dashboard-grid" style={{ marginTop: 0 }}>
        <p className="uwe-dashboard-highlight">
          Routing: <strong>{ROUTING_LABELS[config.routingMode]}</strong>
          {config.routingMode === "LOCAL_THEN_CLOUD" && (
            <span className="uwe-muted"> · empfohlen</span>
          )}
        </p>
        <p className="uwe-dashboard-highlight">
          RTX: <strong>{rtxLabel}</strong>
          {" · "}
          <Link href="/system/rtx-connector">Connector</Link>
        </p>
        <p className="uwe-dashboard-highlight uwe-dashboard-card-wide">
          Cloud-Fallback: <strong>{config.cloudFallbackEnabled ? "Ja" : "Nein"}</strong>
        </p>
      </div>
      {rtxHealth.message && <p className="uwe-muted">{rtxHealth.message}</p>}
    </section>
  );
}
