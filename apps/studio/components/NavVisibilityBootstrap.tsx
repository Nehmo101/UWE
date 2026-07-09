"use client";

import { useEffect } from "react";

/** Hydrates client nav visibility from server-persisted settings (#611). */
export function NavVisibilityBootstrap({ hiddenNavIds }: { hiddenNavIds: string[] }) {
  useEffect(() => {
    if (hiddenNavIds.length === 0) {
      return;
    }
    try {
      window.localStorage.setItem("uwe:nav:hidden-ids", JSON.stringify(hiddenNavIds));
      window.dispatchEvent(new CustomEvent("uwe:nav-visibility-changed"));
    } catch {
      // ignore storage errors
    }
  }, [hiddenNavIds]);

  return null;
}
