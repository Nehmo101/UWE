/**
 * Connector workflow defaults — host-side mapping of each UWE use-case slot to a
 * specific connector model ({ connectorId, modelId }).
 *
 * The connector remains the source of truth for which models exist and their
 * metadata (reported on heartbeat). The host only stores the user's choice of
 * default model per workflow slot and surfaces the picker models that online
 * connectors currently advertise. No world/brain/personal data is involved —
 * only model descriptors.
 */

import type { ConnectorModelType, ConnectorStatus } from "@uwe/connector";

import type { PrismaClient } from "./client";
import {
  toConnectorView,
  type ConnectorModelInfo,
  type ConnectorView,
} from "./connector-service";

export const CONNECTOR_WORKFLOW_SLOTS = [
  "chat",
  "code",
  "dnd",
  "analysis",
  "embedding",
  "vision",
] as const;

export type ConnectorWorkflowSlot = (typeof CONNECTOR_WORKFLOW_SLOTS)[number];

const WORKFLOW_SLOT_SET = new Set<string>(CONNECTOR_WORKFLOW_SLOTS);

export function isConnectorWorkflowSlot(value: unknown): value is ConnectorWorkflowSlot {
  return typeof value === "string" && WORKFLOW_SLOT_SET.has(value);
}

/** Friendly German labels for each workflow slot, used in the Studio UI. */
export const CONNECTOR_WORKFLOW_SLOT_LABELS: Record<ConnectorWorkflowSlot, string> = {
  chat: "Chat / Allgemein",
  code: "Code",
  dnd: "DnD-Generator",
  analysis: "Analyse / Zusammenfassung",
  embedding: "Embeddings",
  vision: "Vision / Bildverständnis",
};

/** A model offered by a connector, flattened for the host model picker. */
export interface ConnectorPickerModel {
  /** Stable model id used to address this model in a workflow default. */
  modelId: string;
  connectorId: string;
  connectorName: string;
  connectorStatus: ConnectorStatus;
  provider: string;
  name: string;
  displayName?: string;
  description?: string;
  bestFor?: string[];
  modelType?: ConnectorModelType;
}

/** Stored default for a workflow slot. */
export interface ConnectorWorkflowDefaultView {
  slot: ConnectorWorkflowSlot;
  connectorId: string;
  modelId: string;
  /** Resolved model when the connector still reports it, else null. */
  model: ConnectorPickerModel | null;
  updatedAt: Date;
}

/**
 * Derive a stable id for a heartbeat model. P5+ connectors report an explicit
 * `id`; for older connectors fall back to a deterministic provider:name key.
 */
export function pickerModelId(model: ConnectorModelInfo): string {
  return model.id ?? `${model.provider}:${model.name}`;
}

function toPickerModel(connector: ConnectorView, model: ConnectorModelInfo): ConnectorPickerModel {
  const entry: ConnectorPickerModel = {
    modelId: pickerModelId(model),
    connectorId: connector.id,
    connectorName: connector.name,
    connectorStatus: connector.status,
    provider: model.provider,
    name: model.name,
  };
  if (model.displayName) entry.displayName = model.displayName;
  if (model.description) entry.description = model.description;
  if (model.bestFor && model.bestFor.length > 0) entry.bestFor = model.bestFor;
  if (model.modelType) entry.modelType = model.modelType;
  return entry;
}

export class ConnectorWorkflowService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Picker models from connectors that are currently online (or degraded). Each
   * model is flattened with its connector so the Studio picker can group by
   * connector and show metadata.
   */
  async listPickerModels(now: Date = new Date()): Promise<ConnectorPickerModel[]> {
    const connectors = await this.db.connector.findMany({ orderBy: { createdAt: "asc" } });
    const models: ConnectorPickerModel[] = [];
    for (const row of connectors) {
      const view = toConnectorView(row, now);
      if (view.status !== "online" && view.status !== "degraded") {
        continue;
      }
      for (const model of view.models) {
        models.push(toPickerModel(view, model));
      }
    }
    return models;
  }

  /** Resolve a model id against a connector's last-reported heartbeat models. */
  async findModel(connectorId: string, modelId: string): Promise<ConnectorPickerModel | null> {
    const row = await this.db.connector.findUnique({ where: { id: connectorId } });
    if (!row) {
      return null;
    }
    const view = toConnectorView(row);
    const model = view.models.find((entry) => pickerModelId(entry) === modelId);
    return model ? toPickerModel(view, model) : null;
  }

  async listDefaults(): Promise<ConnectorWorkflowDefaultView[]> {
    const rows = await this.db.connectorWorkflowDefault.findMany();
    const bySlot = new Map(rows.map((row) => [row.slot as ConnectorWorkflowSlot, row]));
    const views: ConnectorWorkflowDefaultView[] = [];
    for (const slot of CONNECTOR_WORKFLOW_SLOTS) {
      const row = bySlot.get(slot);
      if (!row) {
        continue;
      }
      const model = await this.findModel(row.connectorId, row.modelId);
      views.push({
        slot,
        connectorId: row.connectorId,
        modelId: row.modelId,
        model,
        updatedAt: row.updatedAt,
      });
    }
    return views;
  }

  async getDefault(slot: ConnectorWorkflowSlot): Promise<ConnectorWorkflowDefaultView | null> {
    const row = await this.db.connectorWorkflowDefault.findUnique({ where: { slot } });
    if (!row) {
      return null;
    }
    const model = await this.findModel(row.connectorId, row.modelId);
    return {
      slot,
      connectorId: row.connectorId,
      modelId: row.modelId,
      model,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Set (or replace) the default model for a slot. Validates the connector
   * exists and currently reports a model with that id. Throws on invalid input
   * so the API layer can return a 400/404.
   */
  async setDefault(
    slot: ConnectorWorkflowSlot,
    connectorId: string,
    modelId: string,
  ): Promise<ConnectorWorkflowDefaultView> {
    const model = await this.findModel(connectorId, modelId);
    if (!model) {
      throw new ConnectorWorkflowValidationError(
        "Das gewählte Modell ist auf diesem Connector nicht (mehr) verfügbar.",
      );
    }

    const row = await this.db.connectorWorkflowDefault.upsert({
      where: { slot },
      create: { slot, connectorId, modelId },
      update: { connectorId, modelId },
    });

    return {
      slot,
      connectorId: row.connectorId,
      modelId: row.modelId,
      model,
      updatedAt: row.updatedAt,
    };
  }

  /** Remove the default for a slot, if any. */
  async clearDefault(slot: ConnectorWorkflowSlot): Promise<void> {
    await this.db.connectorWorkflowDefault.deleteMany({ where: { slot } });
  }
}

/** Raised when a workflow default cannot be applied (invalid model/connector). */
export class ConnectorWorkflowValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConnectorWorkflowValidationError";
  }
}

export function createConnectorWorkflowService(db: PrismaClient): ConnectorWorkflowService {
  return new ConnectorWorkflowService(db);
}
