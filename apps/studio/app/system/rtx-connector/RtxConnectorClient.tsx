"use client";

import { useCallback, useEffect, useState } from "react";

import { CONNECTOR_CAPABILITY_LABELS, type ConnectorCapability } from "@uwe/connector/client";
import { RtxStatusBadge, type RtxConnectorState } from "@uwe/shared-ui";

import {
  ConnectorModelPicker,
  type ConnectorPickerModelView,
} from "@/components/ConnectorModelPicker";
import { ConnectorCapabilityGovernance } from "./ConnectorCapabilityGovernance";
import { Alert, Button, Card, Input, cn } from "@/src/components/ui";

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
  directConnected: boolean;
  capabilities: ConnectorCapability[];
  reportedCapabilities: ConnectorCapability[];
  allowedCapabilities: ConnectorCapability[] | null;
  models: ConnectorModelView[];
  version: string | null;
  currentJobs: number;
  lastError: string | null;
  lastHeartbeatAt: string | Date | null;
}

interface DirectSessionView {
  connectorId: string;
  capabilities: ConnectorCapability[];
  laneUsage: Record<string, number>;
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
  hostDirectEnabled: boolean;
  initialDirectSessions: DirectSessionView[];
  cloudFallbackAllowed: boolean;
}

const STATUS_LABELS: Record<ConnectorView["status"], string> = {
  online: "Online",
  offline: "Offline",
  degraded: "Eingeschränkt",
  disabled: "Deaktiviert",
};

type ConnectorSeverity = "ok" | "warn" | "error";

/** Status-Ampel-Klassen für die Connector-Karten (Muster: hardware/page.tsx). */
const CONNECTOR_BORDER_CLASS: Record<ConnectorSeverity, string> = {
  ok: "border-success/40",
  warn: "border-warning/40",
  error: "border-destructive/40",
};

function connectorSeverity(status: ConnectorView["status"]): ConnectorSeverity {
  if (status === "online") return "ok";
  if (status === "degraded") return "warn";
  return "error";
}

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
  hostDirectEnabled,
  initialDirectSessions,
  cloudFallbackAllowed,
}: Props) {
  const [summary, setSummary] = useState(initialSummary);
  const [pendingByLane, setPendingByLane] = useState(initialPendingByLane);
  const [directSessions, setDirectSessions] = useState(initialDirectSessions);
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
      directSessions: DirectSessionView[];
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
    setDirectSessions(data.directSessions);
    await loadWorkflow();
  }, [loadWorkflow]);

  useEffect(() => {
    const timer = setInterval(() => {
      void reload();
    }, 5000);

    return () => clearInterval(timer);
  }, [reload]);

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
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Queue & Sicherheit</h2>
          <RtxStatusBadge
            state={summary.anyOnline ? "online" : "offline"}
            label={
              summary.anyOnline
                ? `RTX online · ${summary.onlineCount}/${summary.totalCount}`
                : "RTX offline"
            }
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="p-4">
            <h3 className="text-sm font-medium">Host-Direct</h3>
            <p className="mt-1 text-sm">{hostDirectEnabled ? "Aktiv" : "Deaktiviert"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Live-Sessions: {directSessions.length}
            </p>
          </Card>
          <Card className="p-4">
            <h3 className="text-sm font-medium">Host-Queue</h3>
            <p className="mt-1 text-sm">
              {hostQueueEnabled ? "Aktiv" : "Pausiert (UWE_HOST_QUEUE_DISABLED=true)"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Wartend:{" "}
              {Object.keys(pendingByLane).length === 0
                ? "0"
                : Object.entries(pendingByLane)
                    .map(([lane, count]) => `${lane}: ${count}`)
                    .join(" · ")}
            </p>
          </Card>
          <Card className="p-4">
            <h3 className="text-sm font-medium">Cloud-Fallback</h3>
            <p className="mt-1 text-sm">{cloudFallbackAllowed ? "Erlaubt" : "Nicht erlaubt"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Tokens werden nur als Hash gespeichert. Connector verbindet ausschließlich ausgehend.
            </p>
          </Card>
        </div>
      </section>

      {error && (
        <Alert tone="danger" role="alert">
          {error}
        </Alert>
      )}

      {issuedToken && (
        <Card className="border-primary/50 p-4" role="alert">
          <strong>Neues Connector-Token — wird nur einmal angezeigt:</strong>
          <pre className="mt-2 select-all whitespace-pre-wrap break-all rounded-[var(--radius)] border border-border bg-muted p-3 text-xs">
            {issuedToken}
          </pre>
          <p className="mt-2 text-sm text-muted-foreground">
            Trage es als <code>UWE_CONNECTOR_TOKEN</code> im RTX Connector ein.
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-2"
            onClick={() => setIssuedToken(null)}
          >
            Verstanden, ausblenden
          </Button>
        </Card>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Connector hinzufügen</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="text"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Name (z. B. RTX Laptop)"
            className="min-w-64"
          />
          <Button
            type="button"
            disabled={busy || newName.trim().length === 0}
            title="Neuen RTX Connector registrieren und einmaliges Token erzeugen"
            onClick={createConnector}
          >
            Token erzeugen
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            title="Connector-Status neu laden"
            onClick={reload}
          >
            Aktualisieren
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Connectors ({summary.totalCount})</h2>
        {summary.connectors.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch kein Connector registriert.</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-3">
            {summary.connectors.map((connector) => {
              const severity = connectorSeverity(connector.status);
              return (
                <Card
                  key={connector.id}
                  className={cn("p-3", CONNECTOR_BORDER_CLASS[severity])}
                  data-status={severity}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-medium">{connector.name}</h3>
                    <RtxStatusBadge
                      state={connectorStatusToRtxState(connector.status)}
                      label={STATUS_LABELS[connector.status]}
                    />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Letzter Heartbeat: {formatWhen(connector.lastHeartbeatAt)}
                    {connector.version ? ` · v${connector.version}` : ""} · Jobs:{" "}
                    {connector.currentJobs}
                  </p>
                  <p className="mt-1 text-sm">
                    Direct: {connector.directConnected ? "live" : "getrennt"} · Queue:{" "}
                    {connector.queueEnabled ? "bereit" : "aus"}
                  </p>
                  <p className="mt-1 text-sm">
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
                  <p className="mt-2 text-sm">Modelle:</p>
                  {connector.models.length === 0 ? (
                    <p className="text-sm text-muted-foreground">—</p>
                  ) : (
                    <ul className="mt-1 list-disc pl-5 text-sm">
                      {connector.models.slice(0, 8).map((model) => (
                        <li key={model.id ?? `${model.provider}:${model.name}`}>
                          <strong>{model.displayName?.trim() || model.name}</strong>{" "}
                          <span className="text-muted-foreground">({model.provider})</span>
                          {model.bestFor && model.bestFor.length > 0 && (
                            <span className="text-muted-foreground"> · {model.bestFor.join(", ")}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {connector.lastError && (
                    <p className="mt-1.5 text-sm text-destructive" role="alert">
                      {connector.lastError}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
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
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      title="Neues Connector-Token erzeugen — das alte Token wird ungültig"
                      onClick={() => patchConnector(connector.id, "rotate-token")}
                    >
                      Token erneuern
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={busy}
                      title="Connector dauerhaft entfernen"
                      onClick={() => deleteConnector(connector.id)}
                    >
                      Entfernen
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Workflow-Standardmodelle</h2>
        <p className="text-sm text-muted-foreground">
          Lege pro Anwendungsfall fest, welches vom Connector gemeldete Modell standardmäßig genutzt
          wird. Es stehen nur Modelle online verbundener Connectors zur Auswahl. Online-/Cloud-KI
          bleibt in den Einstellungen und im AI Gateway konfigurierbar.
        </p>
        {!workflow ? (
          <p className="text-sm text-muted-foreground">Workflow-Standards werden geladen…</p>
        ) : workflow.pickerModels.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Keine Connector-Modelle verfügbar. Aktiviere Modelle im RTX Connector und stelle sicher,
            dass er online ist.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {workflow.slots.map((slot) => {
              const current = workflow.defaults.find((entry) => entry.slot === slot) ?? null;
              return (
                <Card key={slot} className="p-4">
                  <ConnectorModelPicker
                    label={WORKFLOW_SLOT_LABELS[slot] ?? slot}
                    models={workflow.pickerModels}
                    value={current ? { connectorId: current.connectorId, modelId: current.modelId } : null}
                    disabled={busy}
                    onChange={(selection) => void saveWorkflowDefault(slot, selection)}
                  />
                  {current && !current.model && (
                    <p className="mt-1.5 text-xs text-destructive" role="alert">
                      Hinterlegtes Modell (<code>{current.modelId}</code>) wird vom Connector aktuell
                      nicht gemeldet.
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
