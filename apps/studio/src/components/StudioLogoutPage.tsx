"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingState } from "@/src/components/ui/states";

export function StudioLogoutPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function logout() {
      try {
        const response = await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "same-origin",
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          if (!cancelled) {
            setError(payload.error ?? "Abmelden fehlgeschlagen.");
          }
          return;
        }

        if (!cancelled) {
          router.replace("/");
          router.refresh();
        }
      } catch {
        if (!cancelled) {
          setError("Verbindung zum Server fehlgeschlagen. Bitte erneut versuchen.");
        }
      }
    }

    void logout();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (error) {
    return (
      <main className="uwe-page uwe-page-centered">
        <section className="uwe-card uwe-card-padded">
          <h1>Abmelden</h1>
          <p className="uwe-auth-message uwe-auth-message-error">{error}</p>
          <p>
            <Link href="/">Zur Startseite</Link>
          </p>
        </section>
      </main>
    );
  }

  return <LoadingState title="Melde ab…" />;
}
