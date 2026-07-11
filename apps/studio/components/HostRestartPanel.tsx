"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  buttonVariants,
} from "@/src/components/ui";

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
      <Card>
        <CardHeader>
          <CardTitle>Dienst neu starten</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Neustart-Status wird geladen…</p>
        </CardContent>
      </Card>
    );
  }

  const confirmReady = confirmText.trim() === "RESTART";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dienst neu starten</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Startet <code>uwe.service</code> neu — Studio und Portal sind kurz offline. Nur auf dem
          Linux-Production-Host verfügbar, wenn <code>UWE_HOST_RESTART_ENABLED=true</code> gesetzt ist.
        </p>

        {error && (
          <Alert tone="danger" role="alert">
            {error}
          </Alert>
        )}

        <dl className="grid grid-cols-[12rem_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Aktivierung</dt>
          <dd>{availability?.enabled ? "UWE_HOST_RESTART_ENABLED=true" : "deaktiviert"}</dd>
          <dt className="text-muted-foreground">Verfügbarkeit</dt>
          <dd>{availability?.available ? "bereit" : availability?.reason ?? "—"}</dd>
        </dl>

        <div className="flex flex-wrap gap-2">
          {canTrigger ? (
            <>
              <Button
                type="button"
                disabled={!availability?.available || triggering}
                onClick={() => setConfirmOpen(true)}
              >
                {triggering ? "Neustart läuft…" : "UWE neu starten"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={loading}
                onClick={() => {
                  setLoading(true);
                  void loadAvailability();
                }}
              >
                Status aktualisieren
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Nur der Owner kann den Host-Neustart auslösen.</p>
          )}
          <Link href="/backup" className={buttonVariants({ variant: "ghost" })}>
            Backup vor Neustart
          </Link>
          <Link href="/admin/audit-log" className={buttonVariants({ variant: "ghost" })}>
            Audit-Log
          </Link>
        </div>

        {confirmOpen && (
          <div
            className="flex flex-col gap-3 rounded-[var(--radius)] border border-destructive/40 bg-destructive/10 p-4"
            role="dialog"
            aria-labelledby="host-restart-confirm-title"
          >
            <p id="host-restart-confirm-title" className="font-medium">
              Host-Neustart wirklich ausführen?
            </p>
            <p className="text-sm text-muted-foreground">
              Alle aktiven Sessions werden kurz unterbrochen. Offene Arbeiten vorher speichern.
            </p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="host-restart-confirm-text">
                Zur Bestätigung <strong>RESTART</strong> eingeben
              </Label>
              <Input
                id="host-restart-confirm-text"
                type="text"
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                placeholder="RESTART"
                autoComplete="off"
                spellCheck={false}
                className="font-mono"
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" disabled={!confirmReady || triggering} onClick={() => void handleTrigger()}>
                Ja, jetzt neu starten
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setConfirmOpen(false);
                  setConfirmText("");
                }}
              >
                Abbrechen
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
