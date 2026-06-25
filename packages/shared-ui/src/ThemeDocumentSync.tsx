"use client";

import { useEffect } from "react";
import { applyThemeAppearance, type ThemeAppearance } from "./visual-theme";

/** Keeps `data-theme` on `<html>` in sync with persisted server appearance settings. */
export function ThemeDocumentSync({ theme }: { theme: ThemeAppearance }) {
  useEffect(() => {
    applyThemeAppearance(theme);
  }, [theme]);

  return null;
}
