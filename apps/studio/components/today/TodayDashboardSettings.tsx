"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  STUDIO_TODAY_PAGE_KEY,
  STUDIO_TODAY_WIDGET_LABELS,
  STUDIO_TODAY_WIDGET_TYPES,
  mergeMissingDefaultWidgets,
  type DashboardWidgetConfig,
} from "@uwe/database/dashboard-layout";

interface TodayDashboardSettingsProps {
  initialWidgets: DashboardWidgetConfig[];
}

export function TodayDashboardSettings({ initialWidgets }: TodayDashboardSettingsProps) {
  const [widgets, setWidgets] = useState(() =>
    mergeMissingDefaultWidgets(STUDIO_TODAY_PAGE_KEY, initialWidgets),
  );
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setWidgets(mergeMissingDefaultWidgets(STUDIO_TODAY_PAGE_KEY, initialWidgets));
  }, [initialWidgets]);

  const toggleWidget = useCallback((widgetType: string) => {
    setWidgets((current) =>
      current.map((widget) =>
        widget.widgetType === widgetType ? { ...widget, visible: !widget.visible } : widget,
      ),
    );
  }, []);

  async function saveLayout() {
    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch(
        `/api/dashboard-layout/${encodeURIComponent(STUDIO_TODAY_PAGE_KEY)}`,
        {
          method: "PUT",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ widgets }),
        },
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Speichern fehlgeschlagen.");
      }
      setStatus("Heute-Widgets gespeichert.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="uwe-form">
      <p className="uwe-hint">
        Wähle, welche Widgets auf <Link href="/today">/today</Link> erscheinen. Reihenfolge und
        Spalten kannst du dort per „Layout bearbeiten“ anpassen.
      </p>
      <div className="uwe-settings-toggle-grid">
        {STUDIO_TODAY_WIDGET_TYPES.map((widgetType) => {
          const widget = widgets.find((entry) => entry.widgetType === widgetType);
          const visible = widget?.visible ?? true;
          return (
            <label key={widgetType} className="uwe-checkbox-row">
              <input
                type="checkbox"
                checked={visible}
                onChange={() => toggleWidget(widgetType)}
              />
              {STUDIO_TODAY_WIDGET_LABELS[widgetType]}
            </label>
          );
        })}
      </div>
      <div className="uwe-form-actions">
        <button
          type="button"
          className="uwe-v2-btn uwe-v2-btn-primary"
          disabled={saving}
          onClick={() => void saveLayout()}
        >
          {saving ? "Speichern…" : "Widgets speichern"}
        </button>
      </div>
      {status ? <p className="uwe-hint">{status}</p> : null}
    </div>
  );
}
