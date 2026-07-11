"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useCallback, useEffect, useState } from "react";
import { formatStudioDate } from "@/src/lib/format";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@/src/components/ui";

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

const PAGE_SIZE = 25;

const TH_CLASS = "border-b border-border px-3 py-2 text-left font-medium text-muted-foreground";
const TD_CLASS = "border-b border-border/60 px-3 py-2 align-top";

/** TODO(design-kit): Native select bleibt — controlled Filter mit Leerwert ("Alle"),
    siehe gleiches Muster in JobsWorkspace.tsx. */
const NATIVE_SELECT_CLASS =
  "h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

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

function escapeCsvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadAuditCsv(entries: AuditEntry[]): void {
  const header = [
    "timestamp",
    "action",
    "actionLabel",
    "actorUserId",
    "targetType",
    "targetId",
    "worldId",
    "ipHash",
    "userAgentHash",
    "metadata",
  ];
  const rows = entries.map((entry) =>
    [
      entry.timestamp,
      entry.action,
      entry.actionLabel,
      entry.actorUserId ?? "",
      entry.targetType,
      entry.targetId ?? "",
      entry.worldId ?? "",
      entry.ipHash ?? "",
      entry.userAgentHash ?? "",
      JSON.stringify(entry.metadataJson ?? ""),
    ]
      .map((cell) => escapeCsvCell(cell))
      .join(","),
  );
  const csv = [header.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `uwe-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AuditLogWorkspace() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [action, setAction] = useState("");
  const [actorUserId, setActorUserId] = useState("");
  const [worldId, setWorldId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [actionLabels, setActionLabels] = useState<Record<string, string>>({});
  const [loginReasonLabels, setLoginReasonLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    setOffset(0);
  }, [action, actorUserId, worldId, from, to]);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (action) params.set("action", action);
    if (actorUserId) params.set("actorUserId", actorUserId);
    if (worldId) params.set("worldId", worldId);
    if (from) params.set("from", new Date(from).toISOString());
    if (to) params.set("to", new Date(to).toISOString());
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(offset));

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
  }, [action, actorUserId, worldId, from, to, offset]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="audit-filter-action">Action</Label>
              <select
                id="audit-filter-action"
                value={action}
                onChange={(event) => setAction(event.target.value)}
                className={NATIVE_SELECT_CLASS}
              >
                <option value="">Alle</option>
                {Object.entries(actionLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="audit-filter-actor">User-ID</Label>
              <Input
                id="audit-filter-actor"
                type="text"
                value={actorUserId}
                onChange={(event) => setActorUserId(event.target.value)}
                placeholder="actorUserId"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="audit-filter-world">World-ID</Label>
              <Input
                id="audit-filter-world"
                type="text"
                value={worldId}
                onChange={(event) => setWorldId(event.target.value)}
                placeholder="worldId"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="audit-filter-from">Von</Label>
              <Input
                id="audit-filter-from"
                type="datetime-local"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="audit-filter-to">Bis</Label>
              <Input
                id="audit-filter-to"
                type="datetime-local"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void loadEntries()}>
              Filtern
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={entries.length === 0}
              onClick={() => downloadAuditCsv(entries)}
            >
              CSV exportieren
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert tone="warning" role="alert" className="mb-6">
          {error}
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            Einträge {loading ? "…" : `(${entries.length} von ${total})`}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {entries.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground">Keine Audit-Einträge für die gewählten Filter.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className={TH_CLASS}>Zeit</th>
                    <th className={TH_CLASS}>Action</th>
                    <th className={TH_CLASS}>Actor</th>
                    <th className={TH_CLASS}>Target</th>
                    <th className={TH_CLASS}>World</th>
                    <th className={TH_CLASS}>IP-Hash</th>
                    <th className={TH_CLASS}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id}>
                      <td className={TD_CLASS}>{formatStudioDate(entry.timestamp)}</td>
                      <td className={TD_CLASS}>{entry.actionLabel}</td>
                      <td className={TD_CLASS}>{entry.actorUserId ?? "—"}</td>
                      <td className={TD_CLASS}>
                        {entry.targetType}
                        {entry.targetId ? ` · ${entry.targetId}` : ""}
                      </td>
                      <td className={TD_CLASS}>{entry.worldId ?? "—"}</td>
                      <td className={TD_CLASS}>
                        <code>{entry.ipHash ? entry.ipHash.slice(0, 12) : "—"}</code>
                      </td>
                      <td className={TD_CLASS}>{formatAuditMetadata(entry.metadataJson, loginReasonLabels)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {total > PAGE_SIZE ? (
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Seite {page} von {pageCount}
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={offset === 0}
                  onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))}
                >
                  Zurück
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={offset + PAGE_SIZE >= total}
                  onClick={() => setOffset((value) => value + PAGE_SIZE)}
                >
                  Weiter
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}
