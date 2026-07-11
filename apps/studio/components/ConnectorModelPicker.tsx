"use client";

import { useMemo } from "react";

/** A connector model flattened for the picker (mirrors the host API shape). */
export interface ConnectorPickerModelView {
  modelId: string;
  connectorId: string;
  connectorName: string;
  connectorStatus: string;
  provider: string;
  name: string;
  displayName?: string;
  description?: string;
  bestFor?: string[];
  modelType?: string;
}

export interface ConnectorModelSelection {
  connectorId: string;
  modelId: string;
}

interface Props {
  models: ConnectorPickerModelView[];
  value: ConnectorModelSelection | null;
  onChange: (selection: ConnectorModelSelection | null) => void;
  label?: string;
  /** Show a leading "no default" option. */
  noneLabel?: string;
  disabled?: boolean;
  id?: string;
}

function modelLabel(model: ConnectorPickerModelView): string {
  const friendly = model.displayName?.trim() || model.name;
  const hint = model.bestFor && model.bestFor.length > 0 ? ` — ${model.bestFor.join(", ")}` : "";
  return `${friendly}${hint}`;
}

function selectionKey(connectorId: string, modelId: string): string {
  return `${connectorId}\u0000${modelId}`;
}

/**
 * Reusable picker for connector-reported models. Groups models by connector and
 * shows the connector's friendly metadata (displayName, bestFor, description).
 * Selection is reported back as { connectorId, modelId }.
 */
export function ConnectorModelPicker({
  models,
  value,
  onChange,
  label,
  noneLabel,
  disabled,
  id,
}: Props) {
  const byConnector = useMemo(() => {
    const groups = new Map<string, { name: string; status: string; models: ConnectorPickerModelView[] }>();
    for (const model of models) {
      const group = groups.get(model.connectorId);
      if (group) {
        group.models.push(model);
      } else {
        groups.set(model.connectorId, {
          name: model.connectorName,
          status: model.connectorStatus,
          models: [model],
        });
      }
    }
    return [...groups.entries()];
  }, [models]);

  const selected = useMemo(
    () =>
      value
        ? models.find(
            (model) => model.connectorId === value.connectorId && model.modelId === value.modelId,
          ) ?? null
        : null,
    [models, value],
  );

  const currentValue = value ? selectionKey(value.connectorId, value.modelId) : "";

  function handleChange(nextValue: string) {
    if (!nextValue) {
      onChange(null);
      return;
    }
    const match = models.find(
      (model) => selectionKey(model.connectorId, model.modelId) === nextValue,
    );
    onChange(match ? { connectorId: match.connectorId, modelId: match.modelId } : null);
  }

  return (
    <label className="ai-brain-field flex flex-col gap-2">
      {label && <span>{label}</span>}
      <select
        id={id}
        value={currentValue}
        disabled={disabled}
        onChange={(event) => handleChange(event.target.value)}
      >
        <option value="">{noneLabel ?? "— Kein Standard"}</option>
        {byConnector.map(([connectorId, group]) => (
          <optgroup key={connectorId} label={group.name}>
            {group.models.map((model) => (
              <option key={model.modelId} value={selectionKey(model.connectorId, model.modelId)}>
                {modelLabel(model)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {selected?.description && (
        <span className="text-sm text-muted-foreground" style={{ fontSize: "0.8rem" }}>
          {selected.description}
        </span>
      )}
    </label>
  );
}
