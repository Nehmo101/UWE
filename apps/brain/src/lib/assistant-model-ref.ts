import type { AssistantModelRef } from "@uwe/brain-assistant/types";

/**
 * Encoding for a connector model reference inside a single form field.
 *
 * The KI-Chat forms are plain progressive-enhancement forms, so a `<select>`
 * has one string to work with — but a reference needs three parts: the
 * connector, the model, and a label snapshot that keeps the UI readable after
 * the connector goes offline.
 *
 * The label goes last and is re-joined on parse, so a label containing the
 * separator survives a round-trip. Connector and model ids are cuid/provider
 * strings and never contain it.
 */
const SEPARATOR = "::";

export function formatAssistantModelRef(ref: {
  connectorId: string;
  modelId: string;
  label: string;
}): string {
  return [ref.connectorId, ref.modelId, ref.label].join(SEPARATOR);
}

export function parseAssistantModelRef(value: string | null | undefined): AssistantModelRef | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const [connectorId, modelId, ...labelParts] = raw.split(SEPARATOR);
  if (!connectorId || !modelId) return null;

  return { connectorId, modelId, label: labelParts.join(SEPARATOR) || modelId };
}

/** True when the option describes the same model as the stored reference. */
export function isSameAssistantModel(
  option: { connectorId: string; modelId: string },
  ref: AssistantModelRef | null,
): boolean {
  return Boolean(ref && option.connectorId === ref.connectorId && option.modelId === ref.modelId);
}
