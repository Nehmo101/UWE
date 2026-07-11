"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/src/components/ui";

const REFRESH_MS = 30_000;

/** Polls the cockpit page via soft navigation — no @uwe/database/server in client. */
export function OwnerCockpitRefresh() {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [router]);

  return (
    <p className="text-sm text-muted-foreground">
      Auto-Refresh alle 30 Sekunden.{" "}
      <Button type="button" variant="ghost" size="sm" onClick={() => router.refresh()}>
        Jetzt aktualisieren
      </Button>
    </p>
  );
}
