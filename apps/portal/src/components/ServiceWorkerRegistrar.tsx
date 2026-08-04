"use client";

import { useEffect } from "react";

/**
 * Meldet den Service Worker des Portals an.
 *
 * Erst nach `load`: die Registrierung soll nicht mit dem ersten Rendern um
 * Bandbreite streiten. Schlägt sie fehl (kein HTTPS, abgeschaltet, privater
 * Modus), bleibt das Portal genau so nutzbar wie vorher — der Tischmodus
 * funktioniert dann nur online.
 */
export function ServiceWorkerRegistrar({
  basePath,
  buildId,
}: {
  basePath: string;
  buildId: string;
}) {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      // Die Build-Kennung in der URL macht jeden Build zu einem neuen Worker:
      // der Browser installiert ihn neu, und `activate` löscht die
      // Cache-Generation des vorigen Builds (siehe sw.js).
      void navigator.serviceWorker
        .register(`${basePath}/sw.js?v=${encodeURIComponent(buildId)}`, {
          scope: `${basePath}/`,
        })
        .catch(() => {
          /* Ohne Worker bleibt das Portal online-only — kein Grund für einen Fehler. */
        });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }

    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, [basePath, buildId]);

  return null;
}
