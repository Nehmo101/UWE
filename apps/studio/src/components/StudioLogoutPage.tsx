"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorState, LoadingState } from "@/src/components/ui/states";

export function StudioLogoutPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const performLogout = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error ?? "Abmelden fehlgeschlagen.");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setError("Verbindung zum Server fehlgeschlagen. Bitte erneut versuchen.");
    }
  }, [router]);

  useEffect(() => {
    void performLogout();
  }, [performLogout]);

  if (error) {
    return (
      <ErrorState
        title="Abmelden fehlgeschlagen — du bist möglicherweise noch angemeldet."
        description={error}
        action={
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] px-4 py-2 text-sm font-medium shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => void performLogout()}
            >
              Erneut versuchen
            </button>
            <Link href="/">Zur Startseite</Link>
          </div>
        }
      />
    );
  }

  return <LoadingState title="Melde ab…" />;
}
