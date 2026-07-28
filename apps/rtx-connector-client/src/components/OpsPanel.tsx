import { useCallback, useEffect, useState } from "react";

import { HealthBadge } from "@uwe/shared-ui";

import { opsInvoke, type OpsAction } from "../lib/tauri";
import { toMessage } from "../lib/connector-runtime-labels";
import { OpsSettingsForm } from "./ops/OpsSettingsForm";
import { OpsSmtpForm } from "./ops/OpsSmtpForm";
import { OpsGoogleSecretForm } from "./ops/OpsGoogleSecretForm";
import { Button } from "./ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";

/**
 * Betrieb — the operations surfaces that moved out of Studio (Abschnitt D):
 * Security, Secrets-Status, Migrationen, Audit-Log, API-Tokens, Webhooks und
 * Einstellungen.
 *
 * Each tab is a thin renderer over one `ops-cli` action. The CLI already returns
 * exactly the shape the old Studio page rendered, so this panel deliberately
 * shows the payload rather than re-modelling it — one place to change when a
 * status shape changes, not two.
 */

interface TabDef {
  id: string;
  label: string;
  /** Read-only tabs render their payload; editors set `action` to null. */
  action: OpsAction | null;
  hint: string;
}

const TABS: TabDef[] = [
  { id: "security", label: "Security", action: "security-status", hint: "Sicherheitsübersicht des Hosts." },
  { id: "secrets", label: "Secrets", action: "secrets-status", hint: "Nur Metadaten — nie ein Klartext-Secret." },
  { id: "migrations", label: "Migrationen", action: "migration-status", hint: "Angewendete und ausstehende Datenbank-Migrationen." },
  { id: "audit", label: "Audit-Log", action: "audit-log", hint: "Die letzten sicherheitsrelevanten Ereignisse." },
  { id: "tokens", label: "API-Tokens", action: "api-tokens-list", hint: "Tokens des Owners. Der Klartext erscheint genau einmal." },
  { id: "webhooks", label: "Webhooks", action: "webhooks-list", hint: "Endpunkte und die letzten Zustellungen." },
  { id: "settings", label: "Einstellungen", action: null, hint: "Systemeinstellungen der Datenbank — bearbeitbar." },
  { id: "setup", label: "Einrichtung", action: "setup-status", hint: "Was ist konfiguriert, was fehlt noch — ohne Secret-Werte." },
  { id: "smtp", label: "SMTP", action: null, hint: "Mail-Zugangsdaten in der Datenbank. Leer = es gilt .env." },
  { id: "google-login", label: "Google-Login", action: null, hint: "Client-Secret für den Google-Login — Schalter und Client-ID stehen unter Einstellungen → Anmeldung." },
];

function summarize(data: unknown): { tone: "ok" | "degraded" | "error"; label: string } | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  if (typeof record.ok === "boolean") {
    return record.ok
      ? { tone: "ok", label: "In Ordnung" }
      : { tone: "degraded", label: "Hinweise vorhanden" };
  }
  return null;
}

export function OpsPanel() {
  const [activeTab, setActiveTab] = useState<TabDef>(TABS[0]);
  const [data, setData] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (tab: TabDef) => {
    if (!tab.action) {
      setBusy(false);
      setError(null);
      setData(null);
      return;
    }
    setBusy(true);
    setError(null);
    setData(null);
    try {
      const result = await opsInvoke(tab.action);
      if (!result.ok) throw new Error(result.message ?? "Abfrage fehlgeschlagen.");
      setData(result.data ?? null);
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load(activeTab);
  }, [activeTab, load]);

  const status = summarize(data);

  return (
    <div className="command-center-stack">
      <section className="command-center-hero">
        <div>
          <span className="connector-kicker">BETRIEB · HOST</span>
          <h3>Betrieb</h3>
          <p>
            Security, Secrets, Migrationen, Audit-Log, API-Tokens, Webhooks und Einstellungen —
            alles, was früher im Studio-Systembereich lag.
          </p>
        </div>
        <div className="command-center-hero-status">
          {status ? <HealthBadge status={status.tone} label={status.label} /> : null}
          <small>{activeTab.label}</small>
        </div>
      </section>

      <div className="connector-checkbox-row" role="tablist" aria-label="Betriebs-Bereiche">
        {TABS.map((tab) => (
          <Button
            key={tab.id}
            role="tab"
            aria-selected={tab.id === activeTab.id}
            variant={tab.id === activeTab.id ? "primary" : "ghost"}
            onClick={() => setActiveTab(tab)}
            disabled={busy}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {error ? <div className="connector-banner connector-banner-error">{error}</div> : null}

      <Card>
        <CardHeader>
          <CardTitle>{activeTab.label}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="connector-muted">{activeTab.hint}</p>
          {activeTab.id === "settings" ? (
            <OpsSettingsForm />
          ) : activeTab.id === "smtp" ? (
            <OpsSmtpForm />
          ) : activeTab.id === "google-login" ? (
            <OpsGoogleSecretForm />
          ) : busy ? (
            <p className="connector-muted">Lade …</p>
          ) : data ? (
            <pre className="connector-pre">{JSON.stringify(data, null, 2)}</pre>
          ) : !error ? (
            <p className="connector-muted">Keine Daten.</p>
          ) : null}
        </CardContent>
        {activeTab.action === null ? null : (
          <CardFooter>
            <Button variant="ghost" onClick={() => void load(activeTab)} disabled={busy}>
              Neu laden
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
