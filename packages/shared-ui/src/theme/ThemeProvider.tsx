"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { applyThemePreferences } from "./applyTheme";
import {
  defaultPreferences,
  loadPreferences,
  savePreferences,
  type UweThemePreferences,
} from "./storage";
import {
  setSyncTimestamp,
  shouldApplyServerPreferences,
} from "./sync";
import type { AppScope } from "./tokens";
import { BackgroundEffect } from "./BackgroundEffect";

interface ThemeContextValue {
  scope: AppScope;
  preferences: UweThemePreferences;
  setPreferences: (next: UweThemePreferences) => void;
  updatePreferences: (patch: Partial<UweThemePreferences>) => void;
  resetPreferences: () => void;
  syncState: "idle" | "syncing" | "synced" | "error";
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const PERSIST_DEBOUNCE_MS = 800;

export function ThemeProvider({
  scope,
  children,
  serverPreferences = null,
  serverUpdatedAt = null,
  onPersist,
}: {
  scope: AppScope;
  children: ReactNode;
  serverPreferences?: UweThemePreferences | null;
  serverUpdatedAt?: string | null;
  onPersist?: (preferences: UweThemePreferences) => Promise<string | void>;
}) {
  const [preferences, setPreferencesState] = useState<UweThemePreferences>(() =>
    typeof window === "undefined"
      ? (serverPreferences ?? defaultPreferences(scope))
      : loadPreferences(scope),
  );
  const [hydrated, setHydrated] = useState(false);
  const [syncState, setSyncState] = useState<ThemeContextValue["syncState"]>("idle");
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipPersistRef = useRef(true);

  useEffect(() => {
    const local = loadPreferences(scope);
    const useServer =
      serverPreferences != null &&
      shouldApplyServerPreferences(scope, serverUpdatedAt ?? undefined);
    const next = useServer ? serverPreferences : local;
    setPreferencesState(next);
    applyThemePreferences(next, scope);
    savePreferences(scope, next);
    if (useServer && serverUpdatedAt) {
      setSyncTimestamp(scope, serverUpdatedAt);
    }
    skipPersistRef.current = true;
    setHydrated(true);
  }, [scope, serverPreferences, serverUpdatedAt]);

  useEffect(() => {
    if (!hydrated) return;
    applyThemePreferences(preferences, scope);
    savePreferences(scope, preferences);

    if (skipPersistRef.current) {
      skipPersistRef.current = false;
      return;
    }

    if (!onPersist) return;

    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
    }

    persistTimerRef.current = setTimeout(() => {
      setSyncState("syncing");
      void onPersist(preferences)
        .then((updatedAt) => {
          if (typeof updatedAt === "string") {
            setSyncTimestamp(scope, updatedAt);
          }
          setSyncState("synced");
        })
        .catch(() => {
          setSyncState("error");
        });
    }, PERSIST_DEBOUNCE_MS);

    return () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
      }
    };
  }, [preferences, scope, hydrated, onPersist]);

  const setPreferences = useCallback((next: UweThemePreferences) => {
    setPreferencesState(next);
  }, []);

  const updatePreferences = useCallback((patch: Partial<UweThemePreferences>) => {
    setPreferencesState((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetPreferences = useCallback(() => {
    const defaults = defaultPreferences(scope);
    setPreferencesState(defaults);
  }, [scope]);

  const value = useMemo(
    () => ({
      scope,
      preferences,
      setPreferences,
      updatePreferences,
      resetPreferences,
      syncState,
    }),
    [scope, preferences, setPreferences, updatePreferences, resetPreferences, syncState],
  );

  return (
    <ThemeContext.Provider value={value}>
      <BackgroundEffect
        pattern={preferences.background}
        effectColor={preferences.bgEffectColor}
        intensity={preferences.bgEffectIntensity}
        themeId={preferences.themeId}
      />
      {children}
    </ThemeContext.Provider>
  );
}

export function useUweTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useUweTheme must be used within ThemeProvider");
  }
  return ctx;
}
