import type { ConnectorSummary, ConnectorView } from "@uwe/database/server";

export const LABEL_PRINT_QUEUE_UNAVAILABLE_MESSAGE =
  "RTX Label-Druck benötigt einen online verbundenen Connector im Queue- oder Hybrid-Modus.";

function isQueueLabelConnector(connector: ConnectorView): boolean {
  return (
    (connector.status === "online" || connector.status === "degraded") &&
    connector.queueEnabled &&
    connector.capabilities.includes("label_printing")
  );
}

export function hasQueueLabelPrintingConnector(
  summary: ConnectorSummary,
  connectorId?: string,
): boolean {
  return summary.connectors.some(
    (connector) =>
      (!connectorId || connector.id === connectorId) && isQueueLabelConnector(connector),
  );
}

export function queueLabelPrintingConnectorIds(summary: ConnectorSummary): Set<string> {
  return new Set(
    summary.connectors
      .filter(isQueueLabelConnector)
      .map((connector) => connector.id),
  );
}
