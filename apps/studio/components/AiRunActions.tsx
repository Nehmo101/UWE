"use client";

import { useState } from "react";

interface Props {
  runId: string;
  worldSlug: string;
  status: string;
  resultText: string | null;
}

export function AiRunActions({ runId, worldSlug, status, resultText }: Props) {
  const [currentStatus, setCurrentStatus] = useState(status);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function updateStatus(newStatus: "applied" | "discarded" | "cancelled") {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/ai/runs/${runId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Status konnte nicht aktualisiert werden.");
      }
      setCurrentStatus(data.run.status);
      setMessage(`Status: ${data.run.status}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Fehler beim Aktualisieren.");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!resultText) return;
    void navigator.clipboard.writeText(resultText);
    setMessage("Ergebnis in Zwischenablage kopiert.");
  }

  const canReview = currentStatus === "completed";

  return (
    <div className="ai-run-actions">
      <div className="ai-brain-actions">
        {resultText && (
          <button type="button" onClick={handleCopy} disabled={loading}>
            Ergebnis kopieren
          </button>
        )}
        {canReview && (
          <>
            <button type="button" onClick={() => void updateStatus("applied")} disabled={loading}>
              Als übernommen markieren
            </button>
            <button type="button" onClick={() => void updateStatus("discarded")} disabled={loading}>
              Als verworfen markieren
            </button>
          </>
        )}
        {(currentStatus === "pending" || currentStatus === "running") && (
          <button type="button" onClick={() => void updateStatus("cancelled")} disabled={loading}>
            Abbrechen
          </button>
        )}
        <a className="uwe-btn" href={`/worlds/${worldSlug}/ai-runs`}>
          Zur Liste
        </a>
      </div>
      {message && <p className="ai-brain-status">{message}</p>}
    </div>
  );
}
