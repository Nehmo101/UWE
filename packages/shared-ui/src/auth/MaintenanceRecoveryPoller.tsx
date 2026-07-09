"use client";

import { useEffect } from "react";

export type MaintenanceAppSurface = "studio" | "portal";

export interface MaintenanceRecoveryPollerProps {
  surface: MaintenanceAppSurface;
  intervalMs?: number;
  redirectTo?: string;
}

interface MaintenanceEvaluateResponse {
  blocked?: boolean;
}

/**
 * Polls maintenance status and reloads when the app is no longer blocked for guests.
 * Uses /api/maintenance/evaluate (reachable during maintenance) rather than page navigation.
 */
export function MaintenanceRecoveryPoller({
  surface,
  intervalMs = 30_000,
  redirectTo = "/",
}: MaintenanceRecoveryPollerProps) {
  useEffect(() => {
    let cancelled = false;

    async function checkMaintenance() {
      try {
        const response = await fetch(
          `/api/maintenance/evaluate?pathname=${encodeURIComponent(redirectTo)}&surface=${surface}`,
          { cache: "no-store" },
        );
        if (!response.ok || cancelled) {
          return;
        }

        const payload = (await response.json()) as MaintenanceEvaluateResponse;
        if (!payload.blocked && !cancelled) {
          window.location.assign(redirectTo);
        }
      } catch {
        // Ignore transient network errors; next poll will retry.
      }
    }

    void checkMaintenance();
    const timer = window.setInterval(() => {
      void checkMaintenance();
    }, intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [surface, intervalMs, redirectTo]);

  return null;
}
