"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { DashboardWidgetConfig } from "@uwe/database/dashboard-layout";

interface LayoutEditorContextValue {
  isEditing: boolean;
  draftWidgets: DashboardWidgetConfig[];
  savedWidgets: DashboardWidgetConfig[];
  startEditing: () => void;
  cancelEditing: () => void;
  setDraftWidgets: (widgets: DashboardWidgetConfig[]) => void;
  applyDraft: () => DashboardWidgetConfig[];
}

const LayoutEditorContext = createContext<LayoutEditorContextValue | null>(null);

export interface LayoutEditorProviderProps {
  initialWidgets: DashboardWidgetConfig[];
  children: ReactNode;
}

export function LayoutEditorProvider({ initialWidgets, children }: LayoutEditorProviderProps) {
  const [savedWidgets, setSavedWidgets] = useState(initialWidgets);
  const [draftWidgets, setDraftWidgets] = useState(initialWidgets);
  const [isEditing, setIsEditing] = useState(false);

  const startEditing = useCallback(() => {
    setDraftWidgets(savedWidgets);
    setIsEditing(true);
  }, [savedWidgets]);

  const cancelEditing = useCallback(() => {
    setDraftWidgets(savedWidgets);
    setIsEditing(false);
  }, [savedWidgets]);

  const applyDraft = useCallback(() => {
    setSavedWidgets(draftWidgets);
    setIsEditing(false);
    return draftWidgets;
  }, [draftWidgets]);

  useEffect(() => {
    setSavedWidgets(initialWidgets);
    if (!isEditing) {
      setDraftWidgets(initialWidgets);
    }
  }, [initialWidgets, isEditing]);

  const value = useMemo(
    () => ({
      isEditing,
      draftWidgets,
      savedWidgets,
      startEditing,
      cancelEditing,
      setDraftWidgets,
      applyDraft,
    }),
    [
      applyDraft,
      cancelEditing,
      draftWidgets,
      isEditing,
      savedWidgets,
      startEditing,
    ],
  );

  return <LayoutEditorContext.Provider value={value}>{children}</LayoutEditorContext.Provider>;
}

export function useLayoutEditor(): LayoutEditorContextValue {
  const context = useContext(LayoutEditorContext);
  if (!context) {
    throw new Error("useLayoutEditor must be used within LayoutEditorProvider");
  }
  return context;
}
