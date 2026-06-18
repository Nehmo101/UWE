"use client";

import { useEffect, useId, useState } from "react";
import {
  BACKGROUND_PATTERN_LABELS,
  buildVisualThemeHtmlAttributes,
  type VisualThemeSettings,
} from "./visual-theme";

export interface VisualThemePreviewProps {
  /** Form id to mirror select/checkbox values from (settings page). */
  formId: string;
  initial: VisualThemeSettings;
}

function readFormState(formId: string): VisualThemeSettings | null {
  const form = document.getElementById(formId);
  if (!(form instanceof HTMLFormElement)) return null;

  const theme = (form.elements.namedItem("theme") as HTMLSelectElement | null)?.value;
  const backgroundPattern = (
    form.elements.namedItem("backgroundPattern") as HTMLSelectElement | null
  )?.value;
  const frostedGlass = (form.elements.namedItem("frostedGlass") as HTMLInputElement | null)
    ?.checked;
  const motionEnabled = (form.elements.namedItem("motionEnabled") as HTMLInputElement | null)
    ?.checked;

  if (!theme || !backgroundPattern) return null;

  return {
    theme: theme as VisualThemeSettings["theme"],
    backgroundPattern: backgroundPattern as VisualThemeSettings["backgroundPattern"],
    frostedGlass: frostedGlass ?? true,
    motionEnabled: motionEnabled ?? true,
  };
}

export function VisualThemePreview({ formId, initial }: VisualThemePreviewProps) {
  const previewId = useId();
  const [state, setState] = useState(initial);

  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;

    function syncFromForm() {
      const next = readFormState(formId);
      if (next) setState(next);
    }

    syncFromForm();
    form.addEventListener("change", syncFromForm);
    form.addEventListener("input", syncFromForm);
    return () => {
      form.removeEventListener("change", syncFromForm);
      form.removeEventListener("input", syncFromForm);
    };
  }, [formId]);

  const attrs = buildVisualThemeHtmlAttributes(state, { appVariant: "studio" });

  return (
    <div className="uwe-theme-preview-wrap">
      <p className="uwe-hint" id={previewId}>
        Live-Vorschau der gewählten Darstellung (wirkt nach Speichern in Studio &amp; Portal).
      </p>
      <div
        className="uwe-theme-preview"
        aria-labelledby={previewId}
        {...attrs}
      >
        <div className="uwe-shell uwe-theme-preview-shell">
          <div className="uwe-theme-preview-topbar">UWE Studio</div>
          <div className="uwe-theme-preview-body">
            <div className="uwe-theme-preview-card">
              <strong>Beispielkarte</strong>
              <span>Lesbarer Text auf Glas- oder Vollfläche.</span>
            </div>
            <div className="uwe-theme-preview-panel">
              <span className="uwe-theme-preview-chip">
                {BACKGROUND_PATTERN_LABELS[state.backgroundPattern]}
              </span>
              <span className="uwe-theme-preview-chip">
                {state.frostedGlass ? "Glas an" : "Glas aus"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
