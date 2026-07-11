import assert from "node:assert/strict";
import { test } from "node:test";

import type { ConnectorSummary, ConnectorView } from "@uwe/database/server";

import {
  hasQueueLabelPrintingConnector,
  queueLabelPrintingConnectorIds,
} from "./label-print-availability";

function connector(
  id: string,
  queueEnabled: boolean,
  status: ConnectorView["status"] = "online",
): ConnectorView {
  return {
    id,
    queueEnabled,
    status,
    capabilities: ["label_printing"],
  } as ConnectorView;
}

function summary(connectors: ConnectorView[]): ConnectorSummary {
  return {
    anyOnline: true,
    onlineCount: connectors.length,
    totalCount: connectors.length,
    availableCapabilities: ["label_printing"],
    connectors,
  };
}

test("Direct-only label capability is not queue-print available", () => {
  const value = summary([connector("direct", false)]);
  assert.equal(hasQueueLabelPrintingConnector(value), false);
  assert.deepEqual([...queueLabelPrintingConnectorIds(value)], []);
});

test("queue label availability can be restricted to the selected connector", () => {
  const value = summary([connector("direct", false), connector("hybrid", true)]);
  assert.equal(hasQueueLabelPrintingConnector(value), true);
  assert.equal(hasQueueLabelPrintingConnector(value, "direct"), false);
  assert.equal(hasQueueLabelPrintingConnector(value, "hybrid"), true);
  assert.deepEqual([...queueLabelPrintingConnectorIds(value)], ["hybrid"]);
});

test("offline queue connectors are not print available", () => {
  assert.equal(hasQueueLabelPrintingConnector(summary([connector("offline", true, "offline")])), false);
});
