"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Keeps Cloudflare/proxy status cards fresh without a full page reload (#616). */
export function CloudflareStatusAutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => {
      router.refresh();
    }, 15000);

    return () => clearInterval(timer);
  }, [router]);

  return (
    <p className="text-xs text-muted-foreground">
      Effektiver Status aktualisiert sich alle 15 Sekunden automatisch.
    </p>
  );
}
