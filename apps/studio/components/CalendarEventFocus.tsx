"use client";

import { useEffect } from "react";

/** Opens the matching event <details> when the URL hash is #event-<id>. */
export function CalendarEventFocus() {
  useEffect(() => {
    const focusFromHash = () => {
      const hash = window.location.hash;
      if (!hash.startsWith("#event-")) return;
      const target = document.querySelector(hash);
      if (!target) return;
      const details = target.querySelector("details");
      if (details) details.open = true;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    focusFromHash();
    window.addEventListener("hashchange", focusFromHash);
    return () => window.removeEventListener("hashchange", focusFromHash);
  }, []);

  return null;
}
