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
import { applyThemePreferences } from "./applyTheme";
import {
  defaultPreferences,
  loadPreferences,
  savePreferences,
  type UweThemePreferences,
} from "./storage";
import type { AppScope } from "./tokens";
import { BackgroundEffect } from "./BackgroundEffect";

interface ThemeContextValue {
  scope: AppScope;
  preferences: UweThemePreferences;
  setPreferences: (next: UweThemePreferences) => void;
  updatePreferences: (patch: Partial<UweThemePreferences>) => void;
  resetPreferences: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  scope,
  children,
}: {
  scope: AppScope;
  children: ReactNode;
}) {
  const [preferences, setPreferencesState] = useState<UweThemePreferences>(() =>
    typeof window === "undefined" ? defaultPreferences(scope) : loadPreferences(scope),
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const loaded = loadPreferences(scope);
    setPreferencesState(loaded);
    applyThemePreferences(loaded, scope);
    setHydrated(true);
  }, [scope]);

  useEffect(() => {
    if (!hydrated) return;
    applyThemePreferences(preferences, scope);
    savePreferences(scope, preferences);
  }, [preferences, scope, hydrated]);

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
    }),
    [scope, preferences, setPreferences, updatePreferences, resetPreferences],
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
