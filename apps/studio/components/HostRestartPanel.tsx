"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface HostRestartAvailability {
  enabled: boolean;
  available: boolean;
  reason: string | null;
  triggerScript: string | null;
}

interface Props {
  canTrigger: boolean;
}

export function HostRestartPanel({ canTrigger }: Props) {
  const [availability, setAvailability] = useState<HostRestartAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const loadAvailability = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch(studioApiUrl("/api/admin/host-restart"));
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? `Status ${response.status}`);
      }
      const payload = (await response.json()) as { availability: HostRestartAvailability };
      setAvailability(payload.availability);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Neustart-Status konnte nicht geladen werden.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAvailability();
  }, [loadAvailability]);

  async function handleTrigger() {
    setTriggering(true);
    setError(null);
    setConfirmOpen(false);
    setConfirmText("");

    try {
      const response = await fetch(studioApiUrl("/api/admin/host-restart"), { method: "POST" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? `Status ${response.status}`);
      }
    } catch (triggerError) {
      setError(
        triggerError instanceof Error
          ? triggerError.message
          : "Host-Neustart konnte nicht ausgeführt werden.",
      );
      setTriggering(false);
      return;
    }

    setError(
      "Neustart ausgelöst — die Verbindung bricht kurz ab. Seite in ein paar Sekunden neu laden.",
    );
    setTriggering(false);
  }

  if (loading && !availability) {
    return (
      <CardShell>
        <p className="text-sm text-muted-foreground">Neustart-Status wird geladen…</p>
      </CardShell>
    );
  }

  const confirmReady = confirmText.trim() === "RESTART";

  return (
    <CardShell>
      <h2 className="text-base font-semibold">Dienst neu starten</h2>
      <p className="text-sm text-muted-foreground">
        Startet <code>uwe.service</code> neu — Studio und Portal sind kurz offline. Nur auf dem
        Linux-Production-Host verfügbar, wenn <code>UWE_HOST_RESTART_ENABLED=true</code> gesetzt ist.
      </p>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <dl className="mt-4 grid grid-cols-[12rem_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Aktivierung</dt>
        <dd>{availability?.enabled ? "UWE_HOST_RESTART_ENABLED=true" : "deaktiviert"}</dd>
        <dt className="text-muted-foreground">Verfügbarkeit</dt>
        <dd>{availability?.available ? "bereit" : availability?.reason ?? "—"}</dd>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        {canTrigger ? (
          <>
            <button
              type="button"
              className="uwe-v2-btn uwe-v2-btn-primary"
              disabled={!availability?.available || triggering}
              onClick={() => setConfirmOpen(true)}
            >
              {triggering ? "Neustart läuft…" : "UWE neu starten"}
            </button>
            <button
              type="button"
              className="uwe-v2-btn uwe-v2-btn-ghost"
              disabled={loading}
              onClick={() => {
                setLoading(true);
                void loadAvailability();
              }}
            >
              Status aktualisieren
            </button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Nur der Owner kann den Host-Neustart auslösen.</p>
        )}
        <Link className="uwe-v2-btn uwe-v2-btn-ghost" href="/backup">
          Backup vor Neustart
        </Link>
        <Link className="uwe-v2-btn uwe-v2-btn-ghost" href="/admin/audit-log">
          Audit-Log
        </Link>
      </div>

      {confirmOpen && (
        <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm" role="dialog">
          <p className="font-medium">Host-Neustart wirklich ausführen?</p>
          <p className="mt-1 text-muted-foreground">
            Alle aktiven Sessions werden kurz unterbrochen. Offene Arbeiten vorher speichern.
          </p>
          <label className="mt-3 block">
            Zur Bestätigung <strong>RESTART</strong> eingeben
            <input
              type="text"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder="RESTART"
              autoComplete="off"
              spellCheck={false}
              className="mt-1 block w-full rounded border bg-background px-2 py-1 font-mono"
            />
          </label>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="uwe-v2-btn uwe-v2-btn-primary"
              disabled={!confirmReady || triggering}
              onClick={() => void handleTrigger()}
            >
              Ja, jetzt neu starten
            </button>
            <button
              type="button"
              className="uwe-v2-btn uwe-v2-btn-ghost"
              onClick={() => {
                setConfirmOpen(false);
                setConfirmText("");
              }}
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </CardShell>
  );
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">{children}</section>
  );
}
