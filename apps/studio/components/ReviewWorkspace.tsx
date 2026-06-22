"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useCallback, useEffect, useState } from "react";
import { formatStudioDate } from "@/src/lib/format";

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
      body: JSON.stringify({ action }),
    });
    const data = (await response.json()) as { ok?: boolean; message?: string; error?: string };
    if (!response.ok) {
      setActionMessage(data.error ?? "Aktion fehlgeschlagen.");
      return;
    }
    setActionMessage(data.message ?? "Erfolgreich.");
    setSelectedId(null);
    setDetail(null);
    void loadReviews();
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
      <section className="uwe-card" style={{ marginBottom: "1.5rem" }}>
        <p>
          <strong>{pendingCount}</strong> offene Reviews
        </p>
      </section>

      <section className="uwe-card uwe-form" style={{ marginBottom: "1.5rem" }}>
        <h2>Filter</h2>
        <div className="uwe-form-grid">
          <label>
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="pending">Offen</option>
              <option value="approved">Freigegeben</option>
              <option value="rejected">Abgelehnt</option>
              <option value="">Alle</option>
            </select>
          </label>
          <label>
            Quelle
            <select value={sourceType} onChange={(event) => setSourceType(event.target.value)}>
              <option value="">Alle</option>
              {Object.entries(sourceLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
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
        </div>
        <button type="button" className="uwe-btn uwe-btn-primary" onClick={() => void loadReviews()}>
          Filtern
        </button>
      </section>

      {error ? <p className="uwe-error">{error}</p> : null}
      {loading ? <p>Lade Reviews…</p> : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        <section className="uwe-card">
          <h2>Liste</h2>
          <table className="uwe-table">
            <thead>
              <tr>
                <th>Typ</th>
                <th>Titel</th>
                <th>Status</th>
                <th>Datum</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.id}
                  onClick={() => void loadDetail(entry.id)}
                  style={{ cursor: "pointer", background: selectedId === entry.id ? "var(--uwe-surface-2)" : undefined }}
                >
                  <td>{sourceLabels[entry.sourceType] ?? entry.sourceType}</td>
                  <td>{entry.title}</td>
                  <td>{statusLabels[entry.status] ?? entry.status}</td>
                  <td>{formatStudioDate(entry.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="uwe-card">
          <h2>Detail & Vorschau</h2>
          {!detail ? <p>Review auswählen.</p> : null}
          {detail ? (
            <>
              <h3>{detail.title}</h3>
              <p>{detail.summary}</p>
              {detail.proposedByDisplayName ? (
                <p>
                  <small>Vorgeschlagen von: {detail.proposedByDisplayName}</small>
                </p>
              ) : null}
              {detail.diff ? (
                <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.85rem" }}>
                  {JSON.stringify(detail.diff, null, 2)}
                </pre>
              ) : null}
              {detail.targetHref ? (
                <p>
                  <a href={detail.targetHref}>Zum Ziel</a>
                </p>
              ) : null}
              {detail.status === "pending" ? (
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                  <button type="button" className="uwe-btn uwe-btn-primary" onClick={() => void runAction("approve")}>
                    Freigeben
                  </button>
                  <button type="button" className="uwe-btn" onClick={() => void runAction("reject")}>
                    Ablehnen
                  </button>
                </div>
              ) : null}
              {actionMessage ? <p>{actionMessage}</p> : null}
              <h4>Kommentare ({comments.length})</h4>
              <ul>
                {comments.map((comment) => (
                  <li key={comment.id}>
                    <strong>{comment.userDisplayName}</strong> ({formatStudioDate(comment.createdAt)}): {comment.content}
                  </li>
                ))}
              </ul>
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                <input
                  type="text"
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value)}
                  placeholder="Kommentar…"
                  style={{ flex: 1 }}
                />
                <button type="button" className="uwe-btn" onClick={() => void submitComment()}>
                  Senden
                </button>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </>
  );
}
