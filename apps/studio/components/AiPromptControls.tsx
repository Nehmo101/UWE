"use client";

import { LoadingSpinner } from "@uwe/shared-ui";
import {
  computePromptUiState,
  deriveStatusChips,
  formatActiveModes,
  type AiContextMode,
  type AiPromptCapabilities,
  type AiProviderMode,
  type AiStatusChip,
} from "@/src/lib/ai-prompt-ui";

function chipLevelClass(level: AiStatusChip["level"]): string {
  switch (level) {
    case "ok":
      return "mobile-ai-chip-ok";
    case "warn":
      return "mobile-ai-chip-warn";
    case "error":
      return "mobile-ai-chip-error";
    default:
      return "mobile-ai-chip-neutral";
  }
}

function SegmentGroup<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  name: string;
  value: T;
  options: Array<{ id: T; label: string; disabled: boolean; disabledReason?: string }>;
  onChange: (next: T) => void;
}) {
  return (
    <fieldset className="mobile-ai-segment-fieldset">
      <legend className="mobile-ai-segment-legend">{legend}</legend>
      <div className="mobile-ai-segment-group" role="radiogroup" aria-label={legend}>
        {options.map((option) => (
          <label
            key={option.id}
            className={`mobile-ai-segment${option.id === value ? " mobile-ai-segment-active" : ""}${option.disabled ? " mobile-ai-segment-disabled" : ""}`}
            title={option.disabled ? option.disabledReason : undefined}
          >
            <input
              type="radio"
              name={name}
              value={option.id}
              checked={option.id === value}
              disabled={option.disabled}
              onChange={() => onChange(option.id)}
              className="mobile-ai-segment-input"
            />
            <span className="mobile-ai-segment-label">{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export interface AiPromptControlsProps {
  caps: AiPromptCapabilities;
  providerMode: AiProviderMode;
  contextMode: AiContextMode;
  onProviderChange: (mode: AiProviderMode) => void;
  onContextChange: (mode: AiContextMode) => void;
  statusLoading?: boolean;
  pageTitle?: string;
  /** Used to evaluate send rules in hints (empty string when only showing controls). */
  promptPreview?: string;
  /** full = mobile/global panel; page = wiki sidebar (compact). */
  variant?: "full" | "page";
}

export function AiPromptControls({
  caps,
  providerMode,
  contextMode,
  onProviderChange,
  onContextChange,
  statusLoading = false,
  pageTitle,
  promptPreview = "x",
  variant = "full",
}: AiPromptControlsProps) {
  const isPageVariant = variant === "page";
  const ui = computePromptUiState(providerMode, contextMode, caps, promptPreview);
  const chips = deriveStatusChips(caps);
  const active = formatActiveModes(providerMode, contextMode);
  const rtxChip = chips.find((chip) => chip.id === "rtx");

  if (isPageVariant) {
    return (
      <>
        {statusLoading ? (
          <LoadingSpinner label="Status wird geladen…" size="sm" />
        ) : (
          <p className="mobile-ai-page-summary" aria-live="polite">
            {pageTitle ? (
              <>
                Seite: <strong>{pageTitle}</strong>
                {" · "}
              </>
            ) : null}
            {rtxChip ? (
              <>
                RTX {rtxChip.value}
                {" · "}
              </>
            ) : null}
            Lokale KI — Weltwissen bleibt auf dem RTX-Rechner.
          </p>
        )}

        {ui.hints.length > 0 && (
          <ul className="mobile-ai-hints" aria-live="polite">
            {ui.hints.map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ul>
        )}
      </>
    );
  }

  return (
    <>
      <section className="mobile-ai-status" aria-label="KI-Status">
        {statusLoading ? (
          <LoadingSpinner label="Status wird geladen…" size="sm" />
        ) : (
          <ul className="mobile-ai-chips">
            {chips.map((chip) => (
              <li key={chip.id} className={`mobile-ai-chip ${chipLevelClass(chip.level)}`}>
                <span className="mobile-ai-chip-label">{chip.label}</span>
                <span className="mobile-ai-chip-value">{chip.value}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mobile-ai-active-modes" aria-live="polite">
        <span className="mobile-ai-active-label">Aktiv</span>
        <span className="mobile-ai-active-value">
          {active.providerLabel} · {active.contextLabel}
        </span>
      </p>

      {pageTitle && (
        <p className="mobile-ai-object-hint">
          Aktuelles Objekt: <strong>{pageTitle}</strong>
        </p>
      )}

      <SegmentGroup
        legend="KI-Modus"
        name="provider"
        value={providerMode}
        options={ui.providerOptions}
        onChange={onProviderChange}
      />

      <SegmentGroup
        legend="Kontext"
        name="context"
        value={contextMode}
        options={ui.contextOptions}
        onChange={onContextChange}
      />

      {ui.hints.length > 0 && (
        <ul className="mobile-ai-hints" aria-live="polite">
          {ui.hints.map((hint) => (
            <li key={hint}>{hint}</li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Re-export UI state helper for parent components (send button, etc.). */
export { computePromptUiState };
