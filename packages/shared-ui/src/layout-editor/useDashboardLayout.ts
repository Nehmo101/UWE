"use client";

import { useCallback, useEffect, useState } from "react";
import type { DashboardLayoutResult, DashboardWidgetConfig } from "@uwe/database/dashboard-layout";

export interface UseDashboardLayoutOptions {
  pageKey: string;
  apiBasePath?: string;
  initialWidgets?: DashboardWidgetConfig[];
  initialIsDefault?: boolean;
}

export interface UseDashboardLayoutState {
  widgets: DashboardWidgetConfig[];
  isDefault: boolean;
  loading: boolean;
  saving: boolean;
  error: string | null;
  reload: () => Promise<void>;
  save: (widgets: DashboardWidgetConfig[]) => Promise<DashboardLayoutResult | null>;
}

export function useDashboardLayout({
  pageKey,
  apiBasePath = "/api/dashboard-layout",
  initialWidgets,
  initialIsDefault = true,
}: UseDashboardLayoutOptions): UseDashboardLayoutState {
  const [widgets, setWidgets] = useState<DashboardWidgetConfig[]>(initialWidgets ?? []);
  const [isDefault, setIsDefault] = useState(initialIsDefault);
  const [loading, setLoading] = useState(initialWidgets === undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiBasePath}/${encodeURIComponent(pageKey)}`, {
        credentials: "same-origin",
      });
      if (!response.ok) {
        throw new Error(`Layout konnte nicht geladen werden (${response.status}).`);
      }
      const payload = (await response.json()) as DashboardLayoutResult;
      setWidgets(payload.widgets);
      setIsDefault(payload.isDefault);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Layout konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [apiBasePath, pageKey]);

  useEffect(() => {
    if (initialWidgets !== undefined) {
      setWidgets(initialWidgets);
      setIsDefault(initialIsDefault);
      setLoading(false);
      return;
    }
    void reload();
  }, [initialIsDefault, initialWidgets, reload]);

  const save = useCallback(
    async (nextWidgets: DashboardWidgetConfig[]) => {
      setSaving(true);
      setError(null);
      try {
        const response = await fetch(`${apiBasePath}/${encodeURIComponent(pageKey)}`, {
          method: "PUT",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ widgets: nextWidgets }),
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? `Layout konnte nicht gespeichert werden (${response.status}).`);
        }
        const payload = (await response.json()) as DashboardLayoutResult;
        setWidgets(payload.widgets);
        setIsDefault(payload.isDefault);
        return payload;
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Layout konnte nicht gespeichert werden.");
        return null;
      } finally {
        setSaving(false);
      }
    },
    [apiBasePath, pageKey],
  );

  return {
    widgets,
    isDefault,
    loading,
    saving,
    error,
    reload,
    save,
  };
}
