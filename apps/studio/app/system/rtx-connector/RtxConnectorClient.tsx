"use client";

import { useCallback, useEffect, useState } from "react";

import { CONNECTOR_CAPABILITY_LABELS, type ConnectorCapability } from "@uwe/connector/client";
import { RtxStatusBadge, type RtxConnectorState } from "@uwe/shared-ui";

import {
  ConnectorModelPicker,
  type ConnectorPickerModelView,
} from "@/components/ConnectorModelPicker";
import { ConnectorCapabilityGovernance } from "./ConnectorCapabilityGovernance";

interface ConnectorModelView {
  id?: string;
  provider: string;
  name: string;
  status?: string;
  displayName?: string;
  description?: string;
  bestFor?: string[];
  modelType?: string;
}

interface WorkflowDefaultView {
  slot: string;
  connectorId: string;
  modelId: string;
  model: ConnectorPickerModelView | null;
}

interface WorkflowState {
  slots: string[];
  pickerModels: ConnectorPickerModelView[];
  defaults: WorkflowDefaultView[];
}

const WORKFLOW_SLOT_LABELS: Record<string, string> = {
  chat: "Chat / Allgemein",
  code: "Code",
  dnd: "DnD-Generator",
  analysis: "Analyse / Zusammenfassung",
  embedding: "Embeddings",
  vision: "Vision / Bildverständnis",
};

interface ConnectorView {
  id: string;
  name: string;
  status: "online" | "offline" | "degraded" | "disabled";
  disabled: boolean;
  queueEnabled: boolean;
  capabilities: ConnectorCapability[];
  reportedCapabilities: ConnectorCapability[];
  allowedCapabilities: ConnectorCapability[] | null;
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

/** Map a connector's status to the shared RTX status-badge dot state. */
function connectorStatusToRtxState(status: ConnectorView["status"]): RtxConnectorState {
  switch (status) {
    case "online":
      return "online";
    case "degraded":
      return "starting";
    case "disabled":
      return "disabled";
    default:
      return "offline";
  }
}

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
  const [workflow, setWorkflow] = useState<WorkflowState | null>(null);

  const loadWorkflow = useCallback(async () => {
    const response = await fetch("/api/admin/connector-workflow", {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return;
    }
    const data = (await response.json()) as WorkflowState;
    setWorkflow(data);
  }, []);

  useEffect(() => {
    void loadWorkflow();
  }, [loadWorkflow]);

  const saveWorkflowDefault = useCallback(
    async (slot: string, selection: { connectorId: string; modelId: string } | null) => {
      setBusy(true);
      setError(null);
      try {
        const response = await fetch("/api/admin/connector-workflow", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slot,
            connectorId: selection?.connectorId ?? null,
            modelId: selection?.modelId ?? null,
          }),
        });
        const data = (await response.json()) as { error?: string };
        if (!response.ok) {
          setError(data.error ?? "Workflow-Standard konnte nicht gespeichert werden.");
          return;
        }
        await loadWorkflow();
      } finally {
        setBusy(false);
      }
    },
    [loadWorkflow],
  );

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
    await loadWorkflow();
  }, [loadWorkflow]);

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
    async (
      id: string,
      action: "enable" | "disable" | "rotate-token" | "set-allowed-capabilities",
      allowedCapabilities?: ConnectorCapability[] | null,
    ) => {
      setBusy(true);
      setError(null);
      try {
        const response = await fetch(`/api/admin/connectors/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            action === "set-allowed-capabilities"
              ? { action, allowedCapabilities: allowedCapabilities ?? null }
              : { action },
          ),
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
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.5rem",
          }}
        >
          <h2 className="uwe-v2-section-title" style={{ margin: 0 }}>
            Queue & Sicherheit
          </h2>
          <RtxStatusBadge
            state={summary.anyOnline ? "online" : "offline"}
            label={
              summary.anyOnline
                ? `RTX online · ${summary.onlineCount}/${summary.totalCount}`
                : "RTX offline"
            }
          />
        </div>
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
            title="Neuen RTX Connector registrieren und einmaliges Token erzeugen"
            onClick={createConnector}
          >
            Token erzeugen
          </button>
          <button
            type="button"
            className="uwe-v2-btn"
            disabled={busy}
            title="Connector-Status neu laden"
            onClick={reload}
          >
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
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <h3 style={{ margin: 0 }}>{connector.name}</h3>
                  <RtxStatusBadge
                    state={connectorStatusToRtxState(connector.status)}
                    label={STATUS_LABELS[connector.status]}
                  />
                </div>
                <p className="uwe-dashboard-muted">
                  Letzter Heartbeat: {formatWhen(connector.lastHeartbeatAt)}
                  {connector.version ? ` · v${connector.version}` : ""} · Jobs:{" "}
                  {connector.currentJobs}
                </p>
                <p>
                  Fähigkeiten (effektiv):{" "}
                  {connector.capabilities.length === 0
                    ? "—"
                    : connector.capabilities
                        .map((cap) => CONNECTOR_CAPABILITY_LABELS[cap])
                        .join(", ")}
                </p>
                <ConnectorCapabilityGovernance
                  connectorId={connector.id}
                  reportedCapabilities={connector.reportedCapabilities ?? connector.capabilities}
                  allowedCapabilities={connector.allowedCapabilities ?? null}
                  disabled={connector.disabled}
                  busy={busy}
                  onSave={async (allowed) =>
                    patchConnector(connector.id, "set-allowed-capabilities", allowed)
                  }
                />
                <p>Modelle:</p>
                {connector.models.length === 0 ? (
                  <p className="uwe-dashboard-muted">—</p>
                ) : (
                  <ul style={{ margin: "0.25rem 0 0", paddingLeft: "1.1rem" }}>
                    {connector.models.slice(0, 8).map((model) => (
                      <li key={model.id ?? `${model.provider}:${model.name}`}>
                        <strong>{model.displayName?.trim() || model.name}</strong>{" "}
                        <span className="uwe-dashboard-muted">({model.provider})</span>
                        {model.bestFor && model.bestFor.length > 0 && (
                          <span className="uwe-dashboard-muted"> · {model.bestFor.join(", ")}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
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
                    title={
                      connector.disabled
                        ? "Connector aktivieren — nimmt wieder RTX-Jobs an"
                        : "Connector deaktivieren — nimmt keine neuen RTX-Jobs an"
                    }
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
                    title="Neues Connector-Token erzeugen — das alte Token wird ungültig"
                    onClick={() => patchConnector(connector.id, "rotate-token")}
                  >
                    Token erneuern
                  </button>
                  <button
                    type="button"
                    className="uwe-v2-btn uwe-v2-btn-danger"
                    disabled={busy}
                    title="Connector dauerhaft entfernen"
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

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Workflow-Standardmodelle</h2>
        <p className="uwe-dashboard-muted">
          Lege pro Anwendungsfall fest, welches vom Connector gemeldete Modell standardmäßig genutzt
          wird. Es stehen nur Modelle online verbundener Connectors zur Auswahl. Online-/Cloud-KI
          bleibt in den Einstellungen und im AI Gateway konfigurierbar.
        </p>
        {!workflow ? (
          <p className="uwe-dashboard-muted">Workflow-Standards werden geladen…</p>
        ) : workflow.pickerModels.length === 0 ? (
          <p className="uwe-dashboard-muted">
            Keine Connector-Modelle verfügbar. Aktiviere Modelle im RTX Connector und stelle sicher,
            dass er online ist.
          </p>
        ) : (
          <div className="uwe-dashboard-grid">
            {workflow.slots.map((slot) => {
              const current = workflow.defaults.find((entry) => entry.slot === slot) ?? null;
              return (
                <article key={slot} className="uwe-v2-card" style={{ padding: "1rem" }}>
                  <ConnectorModelPicker
                    label={WORKFLOW_SLOT_LABELS[slot] ?? slot}
                    models={workflow.pickerModels}
                    value={current ? { connectorId: current.connectorId, modelId: current.modelId } : null}
                    disabled={busy}
                    onChange={(selection) => void saveWorkflowDefault(slot, selection)}
                  />
                  {current && !current.model && (
                    <p className="uwe-form-error" style={{ marginTop: "0.4rem", fontSize: "0.8rem" }}>
                      Hinterlegtes Modell (<code>{current.modelId}</code>) wird vom Connector aktuell
                      nicht gemeldet.
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
