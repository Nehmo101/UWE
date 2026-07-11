"use client";

import { useMemo, useState } from "react";

import {
  CONNECTOR_CAPABILITY_LABELS,
  type ConnectorCapability,
} from "@uwe/connector/client";
import { Button } from "@/src/components/ui";

const CHECKBOX_ROW_CLASS = "flex items-center gap-2 text-sm";
const CHECKBOX_CLASS = "size-4 rounded border-input";

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
      <p className="mt-1.5 text-sm text-muted-foreground">
        Host-Freigabe: wartet auf ersten Heartbeat mit Fähigkeiten.
      </p>
    );
  }

  return (
    <div className="mt-2">
      <p className="mb-1.5 text-sm">
        <strong>Host-Freigabe:</strong> {formatAllowlist(allowedCapabilities)}
      </p>
      {!editing ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={busy || disabled}
          onClick={() => {
            setDraft(allowedCapabilities ?? reportedCapabilities);
            setEditing(true);
          }}
        >
          Freigaben bearbeiten
        </Button>
      ) : (
        <fieldset
          className="mt-1.5 rounded-[var(--radius)] border border-border p-2.5"
          aria-label={`Host-Freigaben für Connector ${connectorId}`}
        >
          <legend className="px-1 text-xs">Erlaubte Fähigkeiten</legend>
          {editableCaps.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine gemeldeten Fähigkeiten.</p>
          ) : (
            <ul className="m-0 grid list-none gap-1.5 p-0">
              {editableCaps.map((cap) => (
                <li key={cap}>
                  {/* TODO(design-kit): kein Checkbox-Kit-Component vorhanden — natives input[type=checkbox] + Tailwind verwendet. */}
                  <label className={CHECKBOX_ROW_CLASS}>
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
                      className={CHECKBOX_CLASS}
                    />
                    {CONNECTOR_CAPABILITY_LABELS[cap]}
                  </label>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={async () => {
                await onSave(draft);
                setEditing(false);
              }}
            >
              Speichern
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={async () => {
                await onSave(null);
                setEditing(false);
              }}
            >
              Uneingeschränkt
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => setEditing(false)}
            >
              Abbrechen
            </Button>
          </div>
        </fieldset>
      )}
    </div>
  );
}
