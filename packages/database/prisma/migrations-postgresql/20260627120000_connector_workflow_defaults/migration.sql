-- Workflow defaults: one connector model per UWE use-case slot.
-- The host stores the chosen { connectorId, modelId } per slot; the connector
-- stays the source of truth for the model metadata reported on heartbeat.

CREATE TYPE "ConnectorWorkflowSlot" AS ENUM ('chat', 'code', 'dnd', 'analysis', 'embedding', 'vision');

CREATE TABLE "connector_workflow_defaults" (
    "id" TEXT NOT NULL,
    "slot" "ConnectorWorkflowSlot" NOT NULL,
    "connector_id" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connector_workflow_defaults_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "connector_workflow_defaults_slot_key" ON "connector_workflow_defaults"("slot");
CREATE INDEX "connector_workflow_defaults_connector_id_idx" ON "connector_workflow_defaults"("connector_id");

ALTER TABLE "connector_workflow_defaults" ADD CONSTRAINT "connector_workflow_defaults_connector_id_fkey" FOREIGN KEY ("connector_id") REFERENCES "connectors" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
