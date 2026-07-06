"use client";

import { useMemo, useState } from "react";

import {
  CONNECTOR_CAPABILITY_LABELS,
  type ConnectorCapability,
} from "@uwe/connector/client";

interface Props {
  connectorId: string;
  reportedCapabilities: ConnectorCapability[];
  allowedCapabilities: ConnectorCapability[] | null;
  disabled: boolean;
  busy: boolean;
  onSave: (allowedCapabilities: ConnectorCapability[] | null) => Promise<void>;
}

function formatAllowlist(allowed: ConnectorCapability[] | null): string {
  if (allowed === null) return "Uneingeschränkt (alle gemeldeten Fähigkeiten)";
  if (allowed.length === 0) return "Alles blockiert";
  return allowed.map((cap) => CONNECTOR_CAPABILITY_LABELS[cap]).join(", ");
}

export function ConnectorCapabilityGovernance({
  connectorId,
  reportedCapabilities,
  allowedCapabilities,
  disabled,
  busy,
  onSave,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ConnectorCapability[]>(
    allowedCapabilities ?? reportedCapabilities,
  );

  const editableCaps = useMemo(() => {
    const seen = new Set(reportedCapabilities);
    return (Object.keys(CONNECTOR_CAPABILITY_LABELS) as ConnectorCapability[]).filter((cap) =>
      seen.has(cap),
    );
  }, [reportedCapabilities]);

  if (reportedCapabilities.length === 0) {
    return (
      <p className="uwe-dashboard-muted" style={{ marginTop: "0.35rem" }}>
        Host-Freigabe: wartet auf ersten Heartbeat mit Fähigkeiten.
      </p>
    );
  }

  return (
    <div style={{ marginTop: "0.5rem" }}>
      <p style={{ margin: "0 0 0.35rem", fontSize: 13 }}>
        <strong>Host-Freigabe:</strong> {formatAllowlist(allowedCapabilities)}
      </p>
      {!editing ? (
        <button
          type="button"
          className="uwe-v2-btn uwe-v2-btn-sm"
          disabled={busy || disabled}
          onClick={() => {
            setDraft(allowedCapabilities ?? reportedCapabilities);
            setEditing(true);
          }}
        >
          Freigaben bearbeiten
        </button>
      ) : (
        <fieldset
          className="uwe-form"
          style={{ marginTop: "0.35rem", padding: "0.65rem", border: "1px solid var(--uwe-border-muted)" }}
          aria-label={`Host-Freigaben für Connector ${connectorId}`}
        >
          <legend style={{ fontSize: 12.5, padding: "0 0.25rem" }}>Erlaubte Fähigkeiten</legend>
          {editableCaps.length === 0 ? (
            <p className="uwe-dashboard-muted">Keine gemeldeten Fähigkeiten.</p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.35rem" }}>
              {editableCaps.map((cap) => (
                <li key={cap}>
                  <label className="uwe-checkbox" style={{ fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={draft.includes(cap)}
                      onChange={(event) => {
                        setDraft((current) =>
                          event.target.checked
                            ? [...current, cap]
                            : current.filter((entry) => entry !== cap),
                        );
                      }}
                    />
                    {CONNECTOR_CAPABILITY_LABELS[cap]}
                  </label>
                </li>
              ))}
            </ul>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.5rem" }}>
            <button
              type="button"
              className="uwe-v2-btn uwe-v2-btn-primary uwe-v2-btn-sm"
              disabled={busy}
              onClick={async () => {
                await onSave(draft);
                setEditing(false);
              }}
            >
              Speichern
            </button>
            <button
              type="button"
              className="uwe-v2-btn uwe-v2-btn-sm"
              disabled={busy}
              onClick={async () => {
                await onSave(null);
                setEditing(false);
              }}
            >
              Uneingeschränkt
            </button>
            <button
              type="button"
              className="uwe-v2-btn uwe-v2-btn-sm"
              disabled={busy}
              onClick={() => setEditing(false)}
            >
              Abbrechen
            </button>
          </div>
        </fieldset>
      )}
    </div>
  );
}
