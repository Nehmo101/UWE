"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCustomThemeAction } from "../app/custom-theme-actions";

export interface CustomThemeSummary {
  id: string;
  label: string;
  description?: string;
  scope: "studio" | "portal" | "both";
  colors: Record<string, string>;
}

const SCOPE_LABEL: Record<CustomThemeSummary["scope"], string> = {
  studio: "Studio",
  portal: "Portal",
  both: "Studio & Portal",
};

const SWATCH_KEYS = ["bg", "panel", "fg", "accent"];

export function CustomThemesManager({ themes }: { themes: CustomThemeSummary[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (themes.length === 0) {
    return (
      <p className="uwe-hint">
        Noch keine eigenen Designs. Erstelle oben eins mit dem Design-Assistenten.
      </p>
    );
  }

  const remove = (id: string) => {
    setPendingId(id);
    setError(null);
    startTransition(async () => {
      try {
        await deleteCustomThemeAction(id);
        router.refresh();
      } catch {
        setError("Löschen fehlgeschlagen.");
      } finally {
        setPendingId(null);
      }
    });
  };

  return (
    <div className="uwe-custom-themes-manager">
      {error && (
        <p className="uwe-notice" role="status">
          {error}
        </p>
      )}
      <ul className="uwe-custom-themes-list">
        {themes.map((theme) => (
          <li key={theme.id} className="uwe-custom-themes-item">
            <span className="uwe-design-assistant-swatch" aria-hidden="true">
              {SWATCH_KEYS.map((k) => (
                <span key={k} style={{ background: theme.colors[k] ?? "#000" }} />
              ))}
            </span>
            <span className="uwe-custom-themes-meta">
              <strong>{theme.label}</strong>
              <span className="uwe-badge">{SCOPE_LABEL[theme.scope]}</span>
              {theme.description && (
                <span className="uwe-custom-themes-desc">{theme.description}</span>
              )}
            </span>
            <button
              type="button"
              className="uwe-btn uwe-btn-ghost"
              onClick={() => remove(theme.id)}
              disabled={pendingId === theme.id}
            >
              {pendingId === theme.id ? "Lösche…" : "Löschen"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
