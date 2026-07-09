"use client";

import { useState } from "react";

const PAGE_SIZE = 15;

export interface ChronicleTimelineEvent {
  id: string;
  dateLabel: string;
  title: string;
  summaryPlayer?: string | null;
  summaryDm?: string | null;
  entityLinks: string;
  deleteForm: React.ReactNode;
}

interface ChronicleTimelineProps {
  events: ChronicleTimelineEvent[];
}

/** Lazy-loaded chronicle timeline (#657) — renders batches on demand. */
export function ChronicleTimeline({ events }: ChronicleTimelineProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const visible = events.slice(0, visibleCount);
  const remaining = events.length - visible.length;

  if (events.length === 0) {
    return <p className="uwe-hint">Noch keine Ereignisse erfasst.</p>;
  }

  return (
    <>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {visible.map((event) => (
          <li
            key={event.id}
            style={{
              marginBottom: "1rem",
              padding: "1rem",
              border: "1px solid rgba(148,163,184,0.12)",
              borderRadius: "0.65rem",
            }}
          >
            <p style={{ margin: "0 0 0.35rem" }}>
              <strong>{event.dateLabel}</strong> — {event.title}
            </p>
            {event.summaryPlayer && (
              <p style={{ margin: "0 0 0.35rem", fontSize: "0.875rem" }}>{event.summaryPlayer}</p>
            )}
            {event.summaryDm && (
              <p style={{ margin: "0 0 0.75rem", fontSize: "0.875rem", opacity: 0.85 }}>
                <em>DM:</em> {event.summaryDm}
              </p>
            )}
            {event.entityLinks && (
              <p style={{ margin: "0 0 0.75rem", fontSize: "0.875rem" }}>{event.entityLinks}</p>
            )}
            {event.deleteForm}
          </li>
        ))}
      </ul>
      {remaining > 0 && (
        <button
          type="button"
          className="uwe-v2-btn uwe-v2-btn-secondary"
          onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
        >
          Ältere Ereignisse laden ({remaining} verbleibend)
        </button>
      )}
    </>
  );
}
