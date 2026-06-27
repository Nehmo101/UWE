-- Workflow defaults: one connector model per UWE use-case slot.
-- The host stores the chosen { connectorId, modelId } per slot; the connector
-- stays the source of truth for the model metadata reported on heartbeat.

CREATE TABLE "connector_workflow_defaults" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slot" TEXT NOT NULL,
    "connector_id" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "connector_workflow_defaults_connector_id_fkey" FOREIGN KEY ("connector_id") REFERENCES "connectors" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "connector_workflow_defaults_slot_key" ON "connector_workflow_defaults"("slot");
CREATE INDEX "connector_workflow_defaults_connector_id_idx" ON "connector_workflow_defaults"("connector_id");
