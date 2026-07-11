"use client";

import { EmptyState } from "@uwe/shared-ui";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useCallback, useEffect, useState } from "react";
import { formatStudioDate } from "@/src/lib/format";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
  Input,
  Label,
} from "@/src/components/ui";

interface ReviewEntry {
  id: string;
  worldId: string;
  sourceType: string;
  sourceId: string;
  status: string;
  title: string;
  summary: string;
  diff: unknown;
  payload: unknown;
  proposedByDisplayName: string | null;
  reviewedByDisplayName: string | null;
  reviewedAt: string | null;
  rejectReason: string | null;
  targetHref: string | null;
  createdAt: string;
  commentCount: number;
}

interface ReviewsResponse {
  entries: ReviewEntry[];
  pendingCount: number;
  statusLabels?: Record<string, string>;
  sourceLabels?: Record<string, string>;
}

interface DiffRow {
  field: string;
  before: string | null;
  after: string | null;
}

const TH_CLASS = "border-b border-border px-3 py-2 text-left font-medium text-muted-foreground";
const TD_CLASS = "border-b border-border/60 px-3 py-2 align-top";
const CHECKBOX_CLASS = "size-4 rounded border-input";

/** TODO(design-kit): natives select bleibt — controlled Filter mit festem Default
    ("pending") bzw. Leerwert ("Alle"), siehe gleiches Muster in AuditLogWorkspace.tsx. */
const NATIVE_SELECT_CLASS =
  "h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatDiffValue(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > 200 ? `${text.slice(0, 199)}…` : text;
}

function buildDiffRows(diff: unknown): DiffRow[] | null {
  if (!isRecord(diff)) return null;
  if ("before" in diff || "after" in diff) {
    const before = diff.before;
    const after = diff.after;
    if (isRecord(before) && isRecord(after)) {
      const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])];
      const rows: DiffRow[] = [];
      for (const field of fields) {
        const inBefore = field in before;
        const inAfter = field in after;
        if (inBefore && inAfter && JSON.stringify(before[field]) === JSON.stringify(after[field])) {
          continue;
        }
        rows.push({
          field,
          before: inBefore ? formatDiffValue(before[field]) : null,
          after: inAfter ? formatDiffValue(after[field]) : null,
        });
      }
      return rows;
    }
    return [
      {
        field: "Inhalt",
        before: before === undefined || before === "" ? null : formatDiffValue(before),
        after: after === undefined || after === "" ? null : formatDiffValue(after),
      },
    ];
  }
  return Object.entries(diff).map(([field, value]) => ({
    field,
    before: null,
    after: formatDiffValue(value),
  }));
}

function ReviewDiff({ diff }: { diff: unknown }) {
  const rows = buildDiffRows(diff);
  const raw = <pre className="whitespace-pre-wrap text-sm">{JSON.stringify(diff, null, 2)}</pre>;
  if (!rows) return raw;
  return (
    <>
      {rows.length === 0 ? (
        <p>
          <small>Keine geänderten Felder erkannt.</small>
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className={TH_CLASS}>Feld</th>
              <th className={TH_CLASS}>Vorher</th>
              <th className={TH_CLASS}>Nachher</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.field}>
                <td className={TD_CLASS}>{row.field}</td>
                <td className={cn(TD_CLASS, "break-words")}>{row.before ?? "—"}</td>
                <td className={cn(TD_CLASS, "break-words")}>{row.after ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <details>
        <summary>Rohdaten</summary>
        {raw}
      </details>
    </>
  );
}

export function ReviewWorkspace() {
  const [entries, setEntries] = useState<ReviewEntry[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("pending");
  const [sourceType, setSourceType] = useState("");
  const [worldId, setWorldId] = useState("");
  const [sourceLabels, setSourceLabels] = useState<Record<string, string>>({});
  const [statusLabels, setStatusLabels] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReviewEntry | null>(null);
  const [comments, setComments] = useState<
    Array<{ id: string; userDisplayName: string; content: string; createdAt: string }>
  >([]);
  const [commentText, setCommentText] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (sourceType) params.set("sourceType", sourceType);
    if (worldId) params.set("worldId", worldId);

    try {
      const response = await fetch(studioApiUrl(`/api/admin/reviews?${params.toString()}`));
      if (!response.ok) {
        throw new Error(`Reviews konnten nicht geladen werden (${response.status}).`);
      }
      const data = (await response.json()) as ReviewsResponse;
      setEntries(data.entries);
      setPendingCount(data.pendingCount);
      if (data.sourceLabels) setSourceLabels(data.sourceLabels);
      if (data.statusLabels) setStatusLabels(data.statusLabels);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, [status, sourceType, worldId]);

  const loadDetail = useCallback(async (reviewId: string) => {
    try {
      const response = await fetch(studioApiUrl(`/api/admin/reviews/${reviewId}`));
      if (!response.ok) return;
      const data = (await response.json()) as {
        review: ReviewEntry;
        comments: Array<{ id: string; userDisplayName: string; content: string; createdAt: string }>;
      };
      setDetail(data.review);
      setComments(data.comments);
      setSelectedId(reviewId);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  async function runAction(action: "approve" | "reject") {
    if (!selectedId) return;
    setActionMessage(null);
    const response = await fetch(studioApiUrl(`/api/admin/reviews/${selectedId}`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        ...(action === "reject" && rejectReason.trim() ? { reason: rejectReason.trim() } : {}),
      }),
    });
    const data = (await response.json()) as { ok?: boolean; message?: string; error?: string };
    if (!response.ok) {
      setActionMessage(data.error ?? "Aktion fehlgeschlagen.");
      return;
    }
    setActionMessage(data.message ?? "Erfolgreich.");
    setRejectReason("");
    setSelectedId(null);
    setDetail(null);
    void loadReviews();
  }

  async function bulkApprove() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setActionMessage(null);
    let okCount = 0;
    for (const id of ids) {
      const response = await fetch(studioApiUrl(`/api/admin/reviews/${id}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      if (response.ok) okCount += 1;
    }
    setActionMessage(`${okCount} von ${ids.length} Reviews freigegeben.`);
    setSelectedIds(new Set());
    setSelectedId(null);
    setDetail(null);
    void loadReviews();
  }

  function describeActiveFilter(): string {
    const parts = [`Status „${status ? statusLabels[status] ?? status : "Alle"}“`];
    if (sourceType) parts.push(`Typ „${sourceLabels[sourceType] ?? sourceType}“`);
    if (worldId) parts.push(`Welt „${worldId}“`);
    return parts.join(", ");
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submitComment() {
    if (!selectedId || !commentText.trim()) return;
    const response = await fetch(studioApiUrl(`/api/admin/reviews/${selectedId}`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "comment", content: commentText.trim() }),
    });
    if (response.ok) {
      setCommentText("");
      void loadDetail(selectedId);
    }
  }

  return (
    <>
      <Card className="mb-6">
        <CardContent className="pt-6">
          <p>
            <strong>{pendingCount}</strong> offene Reviews
          </p>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="review-filter-status">Status</Label>
              <select
                id="review-filter-status"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className={NATIVE_SELECT_CLASS}
              >
                <option value="pending">Offen</option>
                <option value="approved">Freigegeben</option>
                <option value="rejected">Abgelehnt</option>
                <option value="">Alle</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="review-filter-source">Typ / Quelle</Label>
              <select
                id="review-filter-source"
                value={sourceType}
                onChange={(event) => setSourceType(event.target.value)}
                className={NATIVE_SELECT_CLASS}
              >
                <option value="">Alle</option>
                {Object.entries(sourceLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="review-filter-world">World-ID</Label>
              <Input
                id="review-filter-world"
                type="text"
                value={worldId}
                onChange={(event) => setWorldId(event.target.value)}
                placeholder="worldId"
              />
            </div>
          </div>
          <Button type="button" onClick={() => void loadReviews()} className="self-start">
            Filtern
          </Button>
        </CardContent>
      </Card>

      {error ? (
        <Alert tone="danger" role="alert" className="mb-6">
          {error}
        </Alert>
      ) : null}
      {loading ? <p className="mb-6 text-sm text-muted-foreground">Lade Reviews…</p> : null}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,24rem),1fr))] gap-6">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3">
            <CardTitle>Liste</CardTitle>
            {status === "pending" && selectedIds.size > 0 ? (
              <Button type="button" size="sm" onClick={() => void bulkApprove()}>
                {selectedIds.size} ausgewählte freigeben
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            {!loading && !error && entries.length === 0 ? (
              <EmptyState
                title="Keine Reviews"
                description={`Für den aktiven Filter (${describeActiveFilter()}) wurden keine Reviews gefunden.`}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      {status === "pending" ? <th className={TH_CLASS} aria-label="Auswahl" /> : null}
                      <th className={TH_CLASS}>Typ</th>
                      <th className={TH_CLASS}>Titel</th>
                      <th className={TH_CLASS}>Status</th>
                      <th className={TH_CLASS}>Datum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr
                        key={entry.id}
                        onClick={() => void loadDetail(entry.id)}
                        className={cn("cursor-pointer", selectedId === entry.id && "bg-muted")}
                      >
                        {status === "pending" ? (
                          <td className={TD_CLASS} onClick={(event) => event.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(entry.id)}
                              onChange={() => toggleSelected(entry.id)}
                              aria-label={`Review ${entry.title} auswählen`}
                              className={CHECKBOX_CLASS}
                            />
                          </td>
                        ) : null}
                        <td className={TD_CLASS}>{sourceLabels[entry.sourceType] ?? entry.sourceType}</td>
                        <td className={TD_CLASS}>{entry.title}</td>
                        <td className={TD_CLASS}>{statusLabels[entry.status] ?? entry.status}</td>
                        <td className={TD_CLASS}>{formatStudioDate(entry.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detail & Vorschau</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {!detail ? <p className="text-sm text-muted-foreground">Review auswählen.</p> : null}
            {detail ? (
              <>
                <h3 className="font-semibold tracking-tight">{detail.title}</h3>
                <p>{detail.summary}</p>
                {detail.proposedByDisplayName ? (
                  <p className="text-sm text-muted-foreground">
                    Vorgeschlagen von: {detail.proposedByDisplayName}
                  </p>
                ) : null}
                {detail.diff ? <ReviewDiff diff={detail.diff} /> : null}
                {detail.targetHref ? (
                  <p>
                    <a href={detail.targetHref} className="text-primary underline-offset-4 hover:underline">
                      Zum Ziel
                    </a>
                  </p>
                ) : null}
                {detail.status === "pending" ? (
                  <div className="mt-4 flex flex-col gap-2">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="review-reject-reason">Ablehnungsgrund (optional)</Label>
                      <Input
                        id="review-reject-reason"
                        type="text"
                        value={rejectReason}
                        onChange={(event) => setRejectReason(event.target.value)}
                        placeholder="Grund für Ablehnung…"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" onClick={() => void runAction("approve")}>
                        Freigeben
                      </Button>
                      <Button type="button" variant="outline" onClick={() => void runAction("reject")}>
                        Ablehnen
                      </Button>
                    </div>
                  </div>
                ) : null}
                {actionMessage ? <p className="text-sm text-muted-foreground">{actionMessage}</p> : null}
                <h4 className="font-medium">Kommentare ({comments.length})</h4>
                <ul className="flex flex-col gap-1 text-sm">
                  {comments.map((comment) => (
                    <li key={comment.id}>
                      <strong>{comment.userDisplayName}</strong> ({formatStudioDate(comment.createdAt)}): {comment.content}
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={commentText}
                    onChange={(event) => setCommentText(event.target.value)}
                    placeholder="Kommentar…"
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" onClick={() => void submitComment()}>
                    Senden
                  </Button>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
