"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useCallback, useEffect, useState } from "react";
import { formatStudioDate } from "@/src/lib/format";

interface AuditEntry {
  id: string;
  timestamp: string;
  actorUserId: string | null;
  action: string;
  actionLabel: string;
  targetType: string;
  targetId: string | null;
  worldId: string | null;
  ipHash: string | null;
  userAgentHash: string | null;
  metadataJson: unknown;
}

interface AuditLogResponse {
  entries: AuditEntry[];
  total: number;
  actionLabels?: Record<string, string>;
  loginReasonLabels?: Record<string, string>;
}

function formatAuditMetadata(
  metadata: unknown,
  loginReasonLabels: Record<string, string>,
): string {
  if (!metadata || typeof metadata !== "object") {
    return "—";
  }

  const record = metadata as Record<string, unknown>;
  const parts: string[] = [];

  if (typeof record.surface === "string") {
    parts.push(`App: ${record.surface}`);
  }

  if (typeof record.email === "string") {
    parts.push(`E-Mail: ${record.email}`);
  }

  if (typeof record.reason === "string") {
    const reasonLabel = loginReasonLabels[record.reason] ?? record.reason;
    parts.push(`Grund: ${reasonLabel}`);
  }

  if (typeof record.errorMessage === "string") {
    parts.push(`Fehler: ${record.errorMessage}`);
  }

  if (typeof record.serverError === "string") {
    parts.push(`Server: ${record.serverError}`);
  }

  if (parts.length > 0) {
    return parts.join(" · ");
  }

  const serialized = JSON.stringify(metadata);
  return serialized.length > 160 ? `${serialized.slice(0, 160)}…` : serialized;
}

export function AuditLogWorkspace() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [action, setAction] = useState("");
  const [actorUserId, setActorUserId] = useState("");
  const [worldId, setWorldId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [actionLabels, setActionLabels] = useState<Record<string, string>>({});
  const [loginReasonLabels, setLoginReasonLabels] = useState<Record<string, string>>({});

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (action) params.set("action", action);
    if (actorUserId) params.set("actorUserId", actorUserId);
    if (worldId) params.set("worldId", worldId);
    if (from) params.set("from", new Date(from).toISOString());
    if (to) params.set("to", new Date(to).toISOString());
    params.set("limit", "100");

    try {
      const response = await fetch(studioApiUrl(`/api/admin/audit-log?${params.toString()}`));
      if (!response.ok) {
        throw new Error(`Audit Log konnte nicht geladen werden (${response.status}).`);
      }
      const data = (await response.json()) as AuditLogResponse;
      setEntries(data.entries);
      setTotal(data.total);
      if (data.actionLabels) {
        setActionLabels(data.actionLabels);
      }
      if (data.loginReasonLabels) {
        setLoginReasonLabels(data.loginReasonLabels);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, [action, actorUserId, worldId, from, to]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  return (
    <>
      <section className="uwe-card uwe-form" style={{ marginBottom: "1.5rem" }}>
        <h2>Filter</h2>
        <div className="uwe-form-grid">
          <label>
            Action
            <select value={action} onChange={(event) => setAction(event.target.value)}>
              <option value="">Alle</option>
              {Object.entries(actionLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            User-ID
            <input
              type="text"
              value={actorUserId}
              onChange={(event) => setActorUserId(event.target.value)}
              placeholder="actorUserId"
            />
          </label>
          <label>
            World-ID
            <input
              type="text"
              value={worldId}
              onChange={(event) => setWorldId(event.target.value)}
              placeholder="worldId"
            />
          </label>
          <label>
            Von
            <input type="datetime-local" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label>
            Bis
            <input type="datetime-local" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
        </div>
        <button type="button" className="uwe-btn uwe-btn-primary" onClick={() => void loadEntries()}>
          Filtern
        </button>
      </section>

      {error && <p className="uwe-notice uwe-notice-warn">{error}</p>}

      <section className="uwe-card">
        <h2>
          Einträge {loading ? "…" : `(${entries.length} / ${total})`}
        </h2>
        {entries.length === 0 && !loading ? (
          <p className="uwe-dashboard-muted">Keine Audit-Einträge für die gewählten Filter.</p>
        ) : (
          <div className="uwe-page-table-wrap">
            <table className="uwe-page-table">
              <thead>
                <tr>
                  <th>Zeit</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Target</th>
                  <th>World</th>
                  <th>IP-Hash</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatStudioDate(entry.timestamp)}</td>
                    <td>{entry.actionLabel}</td>
                    <td>{entry.actorUserId ?? "—"}</td>
                    <td>
                      {entry.targetType}
                      {entry.targetId ? ` · ${entry.targetId}` : ""}
                    </td>
                    <td>{entry.worldId ?? "—"}</td>
                    <td>
                      <code>{entry.ipHash ? entry.ipHash.slice(0, 12) : "—"}</code>
                    </td>
                    <td>{formatAuditMetadata(entry.metadataJson, loginReasonLabels)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
