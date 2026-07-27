"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Alert } from "@/src/components/ui/states";
import { Button } from "@/src/components/ui/button";

interface GoogleAccountLinkCardProps {
  /** Whether Google login is enabled in the system settings. */
  enabled: boolean;
  /** Whether this account already has a linked Google identity. */
  linked: boolean;
  /** Google e-mail recorded at link time (diagnostics only). */
  linkedEmail?: string | null;
  /** OAuth start URL with `intent=link` (full-page redirect). */
  startUrl: string;
  /** Unlink endpoint (POST). */
  unlinkUrl: string;
}

function GoogleAccountLinkCardInner({
  enabled,
  linked,
  linkedEmail,
  startUrl,
  unlinkUrl,
}: GoogleAccountLinkCardProps) {
  const searchParams = useSearchParams();
  const justLinked = searchParams.get("linked") === "google";
  const linkConflict = searchParams.get("error") === "google_link_conflict";

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    linkConflict
      ? "Dieses Google-Konto ist bereits mit einem anderen UWE-Konto verknüpft."
      : null,
  );

  async function handleUnlink() {
    if (!window.confirm("Google-Verknüpfung wirklich entfernen?")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(unlinkUrl, {
        method: "POST",
        credentials: "same-origin",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Die Verknüpfung konnte nicht entfernt werden.");
        return;
      }
      window.location.reload();
    } catch {
      setError("Verbindung zum Server fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setBusy(false);
    }
  }

  if (!enabled) {
    return (
      <p className="text-sm text-muted-foreground">
        Google-Login ist derzeit deaktiviert.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {linked ? (
        <p className="text-sm">
          Verknüpft mit Google{linkedEmail ? ` (${linkedEmail})` : ""}. Du kannst dich mit
          „Mit Google anmelden“ einloggen.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Kein Google-Konto verknüpft. Nach der Verknüpfung kannst du dich ohne Passwort über
          Google anmelden.
        </p>
      )}

      {justLinked ? <Alert tone="success">Google-Konto wurde verknüpft.</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div className="flex flex-wrap gap-2">
        {linked ? (
          <Button type="button" variant="outline" disabled={busy} onClick={handleUnlink}>
            {busy ? "Entferne…" : "Verknüpfung entfernen"}
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              window.location.assign(startUrl);
            }}
          >
            Mit Google verknüpfen
          </Button>
        )}
      </div>
    </div>
  );
}

export function GoogleAccountLinkCard(props: GoogleAccountLinkCardProps) {
  return (
    <Suspense fallback={null}>
      <GoogleAccountLinkCardInner {...props} />
    </Suspense>
  );
}
