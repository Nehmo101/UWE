"use client";

import { useCallback, useState } from "react";

import { CONNECTOR_CAPABILITY_LABELS, type ConnectorCapability } from "@uwe/connector/client";

interface ConnectorModelView {
  provider: string;
  name: string;
  status?: string;
}

interface ConnectorView {
  id: string;
  name: string;
  status: "online" | "offline" | "degraded" | "disabled";
  disabled: boolean;
  queueEnabled: boolean;
  capabilities: ConnectorCapability[];
  models: ConnectorModelView[];
  version: string | null;
  currentJobs: number;
  lastError: string | null;
  lastHeartbeatAt: string | Date | null;
}

interface ConnectorSummaryView {
  anyOnline: boolean;
  onlineCount: number;
  totalCount: number;
  availableCapabilities: ConnectorCapability[];
  connectors: ConnectorView[];
}

interface Props {
  initialSummary: ConnectorSummaryView;
  initialPendingByLane: Record<string, number>;
  hostQueueEnabled: boolean;
  cloudFallbackAllowed: boolean;
}

const STATUS_LABELS: Record<ConnectorView["status"], string> = {
  online: "Online",
  offline: "Offline",
  degraded: "Eingeschränkt",
  disabled: "Deaktiviert",
};

function formatWhen(value: string | Date | null): string {
  if (!value) return "noch nie";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "unbekannt";
  return date.toLocaleString("de-DE");
}

export function RtxConnectorClient({
  initialSummary,
  initialPendingByLane,
  hostQueueEnabled,
  cloudFallbackAllowed,
}: Props) {
  const [summary, setSummary] = useState(initialSummary);
  const [pendingByLane, setPendingByLane] = useState(initialPendingByLane);
  const [newName, setNewName] = useState("RTX Laptop");
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    const response = await fetch("/api/admin/connectors", { headers: { Accept: "application/json" } });
    if (!response.ok) {
      setError("Connector-Status konnte nicht geladen werden.");
      return;
    }
    const data = (await response.json()) as {
      connectors: ConnectorView[];
      pendingByLane: Record<string, number>;
    };
    setSummary((prev) => ({
      ...prev,
      connectors: data.connectors,
      totalCount: data.connectors.length,
      onlineCount: data.connectors.filter((c) => c.status === "online" || c.status === "degraded")
        .length,
      anyOnline: data.connectors.some((c) => c.status === "online" || c.status === "degraded"),
    }));
    setPendingByLane(data.pendingByLane);
  }, []);

  const createConnector = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      const data = (await response.json()) as { token?: string; error?: string };
      if (!response.ok || !data.token) {
        setError(data.error ?? "Connector konnte nicht erstellt werden.");
        return;
      }
      setIssuedToken(data.token);
      await reload();
    } finally {
      setBusy(false);
    }
  }, [newName, reload]);

  const patchConnector = useCallback(
    async (id: string, action: "enable" | "disable" | "rotate-token") => {
      setBusy(true);
      setError(null);
      try {
        const response = await fetch(`/api/admin/connectors/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const data = (await response.json()) as { token?: string; error?: string };
        if (!response.ok) {
          setError(data.error ?? "Aktion fehlgeschlagen.");
          return;
        }
        if (action === "rotate-token" && data.token) {
          setIssuedToken(data.token);
        }
        await reload();
      } finally {
        setBusy(false);
      }
    },
    [reload],
  );

  const deleteConnector = useCallback(
    async (id: string) => {
      setBusy(true);
      setError(null);
      try {
        const response = await fetch(`/api/admin/connectors/${id}`, { method: "DELETE" });
        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          setError(data.error ?? "Löschen fehlgeschlagen.");
          return;
        }
        await reload();
      } finally {
        setBusy(false);
      }
    },
    [reload],
  );

  return (
    <>
      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Queue & Sicherheit</h2>
        <div className="uwe-dashboard-grid">
          <article className="uwe-v2-card" style={{ padding: "1rem" }}>
            <h3>Host-Queue</h3>
            <p>{hostQueueEnabled ? "Aktiv" : "Pausiert (UWE_HOST_QUEUE_DISABLED=true)"}</p>
            <p className="uwe-dashboard-muted">
              Wartend:{" "}
              {Object.keys(pendingByLane).length === 0
                ? "0"
                : Object.entries(pendingByLane)
                    .map(([lane, count]) => `${lane}: ${count}`)
                    .join(" · ")}
            </p>
          </article>
          <article className="uwe-v2-card" style={{ padding: "1rem" }}>
            <h3>Cloud-Fallback</h3>
            <p>{cloudFallbackAllowed ? "Erlaubt" : "Nicht erlaubt"}</p>
            <p className="uwe-dashboard-muted">
              Tokens werden nur als Hash gespeichert. Connector verbindet ausschließlich ausgehend.
            </p>
          </article>
        </div>
      </section>

      {error && (
        <section className="uwe-form-error uwe-v2-section" role="alert">
          {error}
        </section>
      )}

      {issuedToken && (
        <section className="uwe-v2-section" role="alert">
          <div className="uwe-v2-card" style={{ padding: "1rem", borderColor: "var(--uwe-accent, #888)" }}>
            <strong>Neues Connector-Token — wird nur einmal angezeigt:</strong>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                marginTop: "0.5rem",
                userSelect: "all",
              }}
            >
              {issuedToken}
            </pre>
            <p className="uwe-dashboard-muted">
              Trage es als <code>UWE_CONNECTOR_TOKEN</code> im RTX Connector ein.
            </p>
            <button type="button" className="uwe-v2-btn" onClick={() => setIssuedToken(null)}>
              Verstanden, ausblenden
            </button>
          </div>
        </section>
      )}

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Connector hinzufügen</h2>
        <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="text"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Name (z. B. RTX Laptop)"
            className="uwe-v2-input"
            style={{ minWidth: "16rem" }}
          />
          <button
            type="button"
            className="uwe-v2-btn uwe-v2-btn-primary"
            disabled={busy || newName.trim().length === 0}
            onClick={createConnector}
          >
            Token erzeugen
          </button>
          <button type="button" className="uwe-v2-btn" disabled={busy} onClick={reload}>
            Aktualisieren
          </button>
        </div>
      </section>

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Connectors ({summary.totalCount})</h2>
        {summary.connectors.length === 0 ? (
          <p className="uwe-dashboard-muted">Noch kein Connector registriert.</p>
        ) : (
          <div className="uwe-homelab-service-grid">
            {summary.connectors.map((connector) => (
              <article
                key={connector.id}
                className="uwe-homelab-service-card"
                data-status={
                  connector.status === "online"
                    ? "ok"
                    : connector.status === "degraded"
                      ? "warn"
                      : "error"
                }
              >
                <h3>
                  {connector.name} — {STATUS_LABELS[connector.status]}
                </h3>
                <p className="uwe-dashboard-muted">
                  Letzter Heartbeat: {formatWhen(connector.lastHeartbeatAt)}
                  {connector.version ? ` · v${connector.version}` : ""} · Jobs:{" "}
                  {connector.currentJobs}
                </p>
                <p>
                  Fähigkeiten:{" "}
                  {connector.capabilities.length === 0
                    ? "—"
                    : connector.capabilities
                        .map((cap) => CONNECTOR_CAPABILITY_LABELS[cap])
                        .join(", ")}
                </p>
                <p>
                  LLMs:{" "}
                  {connector.models.length === 0
                    ? "—"
                    : connector.models
                        .slice(0, 6)
                        .map((model) => `${model.name} (${model.provider})`)
                        .join(", ")}
                </p>
                {connector.lastError && (
                  <p className="uwe-form-error" style={{ marginTop: "0.35rem" }}>
                    {connector.lastError}
                  </p>
                )}
                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
                  <button
                    type="button"
                    className="uwe-v2-btn"
                    disabled={busy}
                    onClick={() =>
                      patchConnector(connector.id, connector.disabled ? "enable" : "disable")
                    }
                  >
                    {connector.disabled ? "Aktivieren" : "Deaktivieren"}
                  </button>
                  <button
                    type="button"
                    className="uwe-v2-btn"
                    disabled={busy}
                    onClick={() => patchConnector(connector.id, "rotate-token")}
                  >
                    Token erneuern
                  </button>
                  <button
                    type="button"
                    className="uwe-v2-btn"
                    disabled={busy}
                    onClick={() => deleteConnector(connector.id)}
                  >
                    Entfernen
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
