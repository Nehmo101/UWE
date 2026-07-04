import { useEffect, useMemo, useState } from "react";

import { ButtonV2, CardV2, HealthBadge } from "@uwe/shared-ui";

import type { ConnectorPrinterStore } from "../lib/tauri";

type Props = {
  loaded: boolean;
  store: ConnectorPrinterStore;
  onLoadStore: () => Promise<ConnectorPrinterStore>;
  onSaveStore: (store: ConnectorPrinterStore) => Promise<ConnectorPrinterStore>;
  onScanPrinters: () => Promise<ConnectorPrinterStore>;
};

function toMessage(error: unknown): string {
  if (typeof error === "string") {
    return error.trim() || "Unbekannter Fehler";
  }
  if (error instanceof Error) {
    return error.message.trim() || "Unbekannter Fehler";
  }
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }
  return "Unbekannter Fehler";
}

/**
 * Drucker panel — like the model picker: enumerate the printers installed on the
 * RTX host and let the user choose which ones UWE may print to. The selection is
 * persisted in the local printer store and advertised to the host on the next
 * heartbeat. Static `.env` configuration remains available for headless setups.
 */
export function PrintersPanel({ loaded, store, onLoadStore, onSaveStore, onScanPrinters }: Props) {
  const [draft, setDraft] = useState(store);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setDraft(store);
  }, [store]);

  useEffect(() => {
    if (loaded) {
      return;
    }

    void (async () => {
      setBusyAction("load");
      setError(null);
      try {
        setDraft(await onLoadStore());
      } catch (nextError) {
        setError(toMessage(nextError));
      } finally {
        setBusyAction(null);
      }
    })();
  }, [loaded, onLoadStore]);

  const stats = useMemo(() => {
    const enabled = draft.printers.filter((printer) => printer.enabledForUwe).length;
    return { total: draft.printers.length, enabled };
  }, [draft.printers]);

  function togglePrinter(id: string, enabledForUwe: boolean) {
    setDraft((current) => ({
      ...current,
      printers: current.printers.map((printer) =>
        printer.id === id ? { ...printer, enabledForUwe } : printer,
      ),
    }));
  }

  async function scanPrinters() {
    setBusyAction("scan");
    setError(null);
    setNotice(null);
    try {
      const scanned = await onScanPrinters();
      setDraft(scanned);
      setNotice(
        scanned.printers.length > 0
          ? `${scanned.printers.length} Drucker gefunden.`
          : "Suche abgeschlossen. Keine installierten Drucker gefunden.",
      );
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setBusyAction(null);
    }
  }

  async function savePrinters() {
    setBusyAction("save");
    setError(null);
    setNotice(null);
    try {
      const saved = await onSaveStore(draft);
      setDraft(saved);
      setNotice(
        stats.enabled > 0
          ? `${stats.enabled} Drucker für UWE freigegeben.`
          : "Auswahl gespeichert. Aktuell ist kein Drucker freigegeben.",
      );
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setBusyAction(null);
    }
  }

  const sortedPrinters = [...draft.printers].sort((left, right) =>
    left.name.localeCompare(right.name, "de"),
  );

  return (
    <div className="connector-stack">
      <CardV2
        title="Drucker für UWE"
        footer={
          <div className="connector-actions">
            <ButtonV2 variant="secondary" onClick={scanPrinters} disabled={busyAction !== null}>
              Drucker suchen
            </ButtonV2>
            <ButtonV2 variant="primary" onClick={savePrinters} disabled={busyAction !== null}>
              Auswahl speichern
            </ButtonV2>
          </div>
        }
      >
        <div className="connector-stack">
          <p className="connector-muted">
            Erkennt die auf dem RTX-Host installierten Drucker (Windows-Spooler bzw. CUPS)
            und meldet nur die freigegebenen an UWE — genau wie bei den Modellen.
          </p>

          {error ? <div className="connector-banner connector-banner-error">{error}</div> : null}
          {notice ? <div className="connector-banner connector-banner-success">{notice}</div> : null}

          <div className="connector-stats-row">
            <div className="connector-stat-pill">Drucker: {stats.total}</div>
            <div className="connector-stat-pill">Für UWE frei: {stats.enabled}</div>
          </div>

          {sortedPrinters.length === 0 ? (
            <div className="connector-empty-state">
              {busyAction === "scan"
                ? "Drucker werden gesucht …"
                : "Noch keine Drucker erkannt. Klicke „Drucker suchen“."}
            </div>
          ) : (
            <div className="connector-profile-list">
              {sortedPrinters.map((printer) => (
                <div key={printer.id} className="connector-inline-card">
                  <div className="connector-inline-card-header">
                    <div>
                      <p className="connector-lead">
                        {printer.name}
                        {printer.isDefault ? " · Standard" : ""}
                      </p>
                      <p className="connector-muted">
                        {printer.id}
                        {printer.state ? ` · ${printer.state}` : ""}
                        {printer.description ? ` · ${printer.description}` : ""}
                      </p>
                    </div>
                    <HealthBadge
                      status={printer.enabledForUwe ? "ok" : "degraded"}
                      label={printer.enabledForUwe ? "Für UWE frei" : "Nur lokal"}
                    />
                  </div>

                  <label className="connector-checkbox">
                    <input
                      type="checkbox"
                      checked={printer.enabledForUwe}
                      onChange={(event) => togglePrinter(printer.id, event.target.checked)}
                    />
                    <span>In UWE als Drucker bereitstellen</span>
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardV2>

      <div className="connector-panel">
        <h3>Alternativ: Drucker über Umgebungsvariable konfigurieren</h3>
        <p className="connector-muted">
          Für Headless-Setups (ohne Client-UI) lassen sich Drucker weiterhin über{" "}
          <code>UWE_CONNECTOR_PRINTERS</code> in{" "}
          <code>tools/uwe-rtx-connector/.env</code> festlegen. Ist die Variable gesetzt,
          hat sie Vorrang vor der Auswahl oben.
        </p>
        <pre className="connector-code">{`# Einzelner Drucker (Zebra LP 2844):
UWE_CONNECTOR_PRINTERS=[{"id":"zebra-lp2844","name":"Zebra LP 2844 Label"}]

# Mehrere Drucker:
# UWE_CONNECTOR_PRINTERS=[{"id":"zebra-lp2844","name":"Zebra LP 2844"},{"id":"hp-lj","name":"HP LaserJet"}]

# Eigener Druckbefehl (optional, Standard: CUPS lp -d <id> <file>):
# UWE_CONNECTOR_PRINT_CMD=lpr -P

# Label-Druck komplett deaktivieren:
# UWE_CONNECTOR_PRINT=false`}</pre>
      </div>
    </div>
  );
}
