/**
 * Resolves *which* AI answers a Brain turn — the "hinterlegte KI".
 *
 * The Command Center curates local models (`enabledForUwe`) and the connector
 * reports them on every heartbeat; `ConnectorWorkflowService.listPickerModels()`
 * returns exactly those, for connectors that are currently online or degraded.
 * The Brain stores the owner's pick as an opaque `{connectorId, modelId}` pair
 * plus a label snapshot, and resolves it back to the technical model name at
 * inference time.
 *
 * Resolution order (chat and vision alike):
 *   1. the conversation's own override
 *   2. the Brain profile ("hinterlegen")
 *   3. the global connector workflow default for the slot
 *   4. null — the gateway then picks its own fallback
 */

import {
  createConnectorWorkflowService,
  type ConnectorWorkflowSlot,
  type PrismaClient,
} from "@uwe/database/server";

import type { AssistantModelOption, AssistantModelRef } from "./assistant-types";

/** Model types offered for the chat slot; a vision-only model cannot chat. */
const CHAT_MODEL_TYPES = new Set(["chat", "other"]);

function labelFor(model: {
  displayName?: string;
  name: string;
  provider: string;
}): string {
  return model.displayName?.trim() || `${model.provider} · ${model.name}`;
}

/**
 * Every model the Command Center currently offers, split by slot suitability.
 * Models without a `modelType` land in both lists — older connectors do not
 * report one and the owner knows their own models best.
 */
export async function listAssignableModels(db: PrismaClient): Promise<{
  chat: AssistantModelOption[];
  vision: AssistantModelOption[];
}> {
  const models = await createConnectorWorkflowService(db).listPickerModels();
  const chat: AssistantModelOption[] = [];
  const vision: AssistantModelOption[] = [];

  for (const model of models) {
    const option: AssistantModelOption = {
      connectorId: model.connectorId,
      connectorName: model.connectorName,
      modelId: model.modelId,
      name: model.name,
      label: labelFor(model),
      description: model.description ?? null,
      bestFor: model.bestFor ?? [],
      modelType: model.modelType ?? null,
      available: true,
    };
    if (!model.modelType || CHAT_MODEL_TYPES.has(model.modelType)) {
      chat.push(option);
    }
    if (!model.modelType || model.modelType === "vision") {
      vision.push(option);
    }
  }

  return { chat, vision };
}

export interface ResolvedAssistantModel {
  /** Technical model name handed to the connector, or null for the gateway default. */
  name: string | null;
  /** Display label for the UI — falls back to the stored snapshot when offline. */
  label: string | null;
  /** False when the reference no longer matches an online connector model. */
  available: boolean;
}

const UNRESOLVED: ResolvedAssistantModel = { name: null, label: null, available: false };

async function resolveRef(
  db: PrismaClient,
  ref: AssistantModelRef | null,
): Promise<ResolvedAssistantModel | null> {
  if (!ref) return null;
  const model = await createConnectorWorkflowService(db).findModel(ref.connectorId, ref.modelId);
  if (!model) {
    // Connector offline or model no longer shared — keep the label so the UI can
    // say *which* model is missing instead of silently switching.
    return { name: null, label: ref.label, available: false };
  }
  return { name: model.name, label: labelFor(model), available: true };
}

/**
 * Resolve the model for one slot, walking conversation override → profile →
 * global workflow default.
 */
export async function resolveAssistantModel(
  db: PrismaClient,
  input: {
    conversationRef: AssistantModelRef | null;
    profileRef: AssistantModelRef | null;
    slot: ConnectorWorkflowSlot;
  },
): Promise<ResolvedAssistantModel> {
  const fromConversation = await resolveRef(db, input.conversationRef);
  if (fromConversation?.available) return fromConversation;

  const fromProfile = await resolveRef(db, input.profileRef);
  if (fromProfile?.available) return fromProfile;

  const workflowDefault = await createConnectorWorkflowService(db).getDefault(input.slot);
  if (workflowDefault?.model) {
    return {
      name: workflowDefault.model.name,
      label: labelFor(workflowDefault.model),
      available: true,
    };
  }

  // Nothing resolved: surface the most specific unavailable reference we have,
  // so the UI can name the model the owner expected.
  return fromConversation ?? fromProfile ?? UNRESOLVED;
}
