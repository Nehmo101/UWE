"use client";

import { useEffect, useId, useState, type CSSProperties } from "react";
import { cn } from "./components/cn";
import {
  BACKGROUND_PATTERN_LABELS,
  buildVisualThemeHtmlAttributes,
  type BackgroundPattern,
  type VisualThemeSettings,
} from "./visual-theme";

/**
 * Pattern-Vorschau pro Hintergrund-Muster — Werte 1:1 aus den
 * body::before-Regeln in uwe-visual-polish.css, hier aber direkt aus dem
 * Formular-State berechnet, damit die Vorschau die AUSWAHL zeigt (nicht den
 * aktuell live gesetzten html[data-uwe-bg-pattern]-Zustand).
 */
const PATTERN_PREVIEW_STYLE: Record<BackgroundPattern, CSSProperties | null> = {
  none: null,
  dots: {
    backgroundImage:
      "radial-gradient(circle, color-mix(in srgb, var(--uwe-fg-muted) 14%, transparent) 1px, transparent 1px)",
    backgroundSize: "22px 22px",
  },
  constellation: {
    backgroundImage: [
      "radial-gradient(1px 1px at 12% 18%, color-mix(in srgb, var(--uwe-fg) 55%, transparent), transparent)",
      "radial-gradient(1px 1px at 28% 72%, color-mix(in srgb, var(--uwe-accent-hover) 50%, transparent), transparent)",
      "radial-gradient(1.5px 1.5px at 44% 34%, color-mix(in srgb, var(--uwe-info) 45%, transparent), transparent)",
      "radial-gradient(1px 1px at 63% 81%, color-mix(in srgb, var(--uwe-fg) 40%, transparent), transparent)",
      "radial-gradient(1px 1px at 78% 22%, color-mix(in srgb, var(--uwe-accent) 45%, transparent), transparent)",
      "radial-gradient(1px 1px at 91% 58%, color-mix(in srgb, var(--uwe-fg-muted) 35%, transparent), transparent)",
    ].join(", "),
  },
  synapse: {
    backgroundImage: [
      "repeating-linear-gradient(72deg, transparent, transparent 46px, color-mix(in srgb, var(--uwe-accent) 7%, transparent) 46px, color-mix(in srgb, var(--uwe-accent) 7%, transparent) 47px)",
      "repeating-linear-gradient(-18deg, transparent, transparent 58px, color-mix(in srgb, var(--uwe-info) 5%, transparent) 58px, color-mix(in srgb, var(--uwe-info) 5%, transparent) 59px)",
      "radial-gradient(ellipse 50% 40% at 50% 0%, var(--uwe-accent-muted), transparent 70%)",
    ].join(", "),
  },
  parchment: {
    backgroundColor: "color-mix(in srgb, var(--uwe-dm-only) 6%, transparent)",
    backgroundImage: [
      "repeating-linear-gradient(0deg, transparent, transparent 3px, color-mix(in srgb, var(--uwe-warning) 5%, transparent) 3px, color-mix(in srgb, var(--uwe-warning) 5%, transparent) 4px)",
      "repeating-linear-gradient(90deg, transparent, transparent 3px, color-mix(in srgb, var(--uwe-dm-only) 4%, transparent) 3px, color-mix(in srgb, var(--uwe-dm-only) 4%, transparent) 4px)",
      "radial-gradient(ellipse 90% 70% at 50% 100%, color-mix(in srgb, var(--uwe-warning) 10%, transparent), transparent 65%)",
    ].join(", "),
  },
  "subtle-noise": {
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.35'/%3E%3C/svg%3E\")",
    backgroundSize: "180px 180px",
    mixBlendMode: "soft-light",
    opacity: 0.35,
  },
};

const SURFACE_GLASS =
  "bg-[var(--uwe-surface-glass,color-mix(in_srgb,var(--uwe-panel)_88%,transparent))] backdrop-blur-[10px]";
const SURFACE_SOLID = "bg-[var(--uwe-surface-elevated,var(--uwe-bg-elevated))]";
const CARD_BASE =
  "rounded-[0.55rem] border border-[var(--uwe-border-subtle,var(--uwe-border-muted))] px-3 py-[0.65rem] text-[0.78rem] leading-[1.45] text-[var(--uwe-text-primary,var(--uwe-fg))]";
const CHIP =
  "inline-flex items-center rounded-full bg-[var(--uwe-accent-muted)] px-[0.45rem] py-[0.15rem] text-[0.68rem] font-semibold text-[var(--uwe-text-primary,var(--uwe-fg))]";

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
  const surface = state.frostedGlass ? SURFACE_GLASS : SURFACE_SOLID;
  const patternStyle = PATTERN_PREVIEW_STYLE[state.backgroundPattern];

  return (
    <div className="mt-5 mb-2">
      <p className="text-sm leading-normal text-muted-foreground" id={previewId}>
        Live-Vorschau der gewählten Darstellung (wirkt nach Speichern in Studio &amp; Portal).
      </p>
      <div
        className="overflow-hidden rounded-[0.85rem] border border-[var(--uwe-border-subtle,var(--uwe-border-muted))] bg-[var(--uwe-surface-base,var(--uwe-bg))]"
        aria-labelledby={previewId}
        {...attrs}
      >
        <div className="relative isolate max-h-56 min-h-44 overflow-auto">
          {patternStyle && (
            <div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={patternStyle} />
          )}
          <div
            className={cn(
              "border-b border-[var(--uwe-border-subtle,var(--uwe-border-muted))] px-[0.85rem] py-[0.55rem] text-[0.8rem] font-semibold text-[var(--uwe-text-primary,var(--uwe-fg))]",
              surface,
            )}
          >
            UWE Studio
          </div>
          <div className="grid gap-[0.65rem] p-[0.85rem]">
            <div className={cn(CARD_BASE, surface)}>
              <strong className="mb-1 block text-[var(--uwe-text-primary,var(--uwe-fg))]">Beispielkarte</strong>
              <span className="text-[var(--uwe-text-muted,var(--uwe-fg-muted))]">
                Lesbarer Text auf Glas- oder Vollfläche.
              </span>
            </div>
            <div className={cn(CARD_BASE, surface, "flex flex-wrap gap-[0.35rem]")}>
              <span className={CHIP}>{BACKGROUND_PATTERN_LABELS[state.backgroundPattern]}</span>
              <span className={CHIP}>{state.frostedGlass ? "Glas an" : "Glas aus"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
