"use client";

import { useEffect } from "react";
import { applyThemeAppearance, type ThemeAppearance } from "@uwe/shared-ui";

export function ThemeDocumentSync({ theme }: { theme: ThemeAppearance }) {
  useEffect(() => {
    applyThemeAppearance(theme);
  }, [theme]);

  return null;
}
