"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const REFRESH_MS = 30_000;

/** Polls the cockpit page via soft navigation — no @uwe/database/server in client. */
export function OwnerCockpitRefresh() {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [router]);

  return (
    <p className="uwe-dashboard-muted">
      Auto-Refresh alle 30 Sekunden.{" "}
      <button type="button" className="uwe-v2-btn uwe-v2-btn-ghost uwe-v2-btn-sm" onClick={() => router.refresh()}>
        Jetzt aktualisieren
      </button>
    </p>
  );
}
