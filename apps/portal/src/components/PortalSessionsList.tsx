"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AVAILABILITY_LABELS,
  AVAILABILITY_STATUSES,
  type SessionAvailabilitySummary,
} from "@uwe/player-hub/availability";

export interface PortalSessionListItem {
  id: string;
  sessionNumber: number;
  title: string;
  status: string;
  dateIso: string | null;
}

interface PortalSessionsListProps {
  worldSlug: string;
  upcoming: PortalSessionListItem[];
  recaps: PortalSessionListItem[];
  availability: Record<string, SessionAvailabilitySummary>;
  viewerId: string | null;
  canVote: boolean;
  setAvailabilityAction: (formData: FormData) => void | Promise<void>;
}

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "full",
  timeStyle: "short",
});

const YEAR_OPTIONS_ALL = "all";

function parseSessionDate(dateIso: string | null): Date | null {
  if (!dateIso) {
    return null;
  }
  const date = new Date(dateIso);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function PortalSessionsList({
  worldSlug,
  upcoming,
  recaps,
  availability,
  viewerId,
  canVote,
  setAvailabilityAction,
}: PortalSessionsListProps) {
  const recapYears = useMemo(() => {
    const years = new Set<number>();
    for (const session of recaps) {
      const date = parseSessionDate(session.dateIso);
      if (date) {
        years.add(date.getFullYear());
      }
    }
    return [...years].sort((a, b) => b - a);
  }, [recaps]);

  const [yearFilter, setYearFilter] = useState<string>(YEAR_OPTIONS_ALL);

  const filteredRecaps = useMemo(() => {
    if (yearFilter === YEAR_OPTIONS_ALL) {
      return recaps;
    }

    const year = Number.parseInt(yearFilter, 10);
    if (!Number.isFinite(year)) {
      return recaps;
    }

    return recaps.filter((session) => {
      const date = parseSessionDate(session.dateIso);
      return date?.getFullYear() === year;
    });
  }, [recaps, yearFilter]);

  return (
    <>
      {upcoming.length > 0 && (
        <>
          <h2>Kommende Sessions</h2>
          <ul className="auth-page-list">
            {upcoming.map((session) => {
              const summary = availability[session.id];
              const ownVote = viewerId
                ? summary?.votes.find((vote) => vote.userId === viewerId)
                : undefined;
              const date = parseSessionDate(session.dateIso);

              return (
                <li key={session.id}>
                  <strong>
                    Session {session.sessionNumber}: {session.title}
                  </strong>
                  <p className="portal-dash-summary">
                    {date ? DATE_FORMAT.format(date) : "Termin noch offen"}
                  </p>

                  {summary && (
                    <p className="auth-muted">
                      Zusagen: {summary.counts.yes} · Vielleicht: {summary.counts.maybe} ·
                      Absagen: {summary.counts.no}
                      {summary.votes.length > 0 && (
                        <>
                          {" — "}
                          {summary.votes
                            .map(
                              (vote) =>
                                `${vote.displayName}: ${AVAILABILITY_LABELS[vote.status]}`,
                            )
                            .join(", ")}
                        </>
                      )}
                    </p>
                  )}

                  {canVote && (
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      {AVAILABILITY_STATUSES.map((status) => (
                        <form key={status} action={setAvailabilityAction}>
                          <input type="hidden" name="worldSlug" value={worldSlug} />
                          <input type="hidden" name="sessionId" value={session.id} />
                          <input type="hidden" name="status" value={status} />
                          <button
                            type="submit"
                            className="auth-inline-button"
                            aria-pressed={ownVote?.status === status}
                            style={
                              ownVote?.status === status
                                ? { fontWeight: 700, textDecoration: "underline" }
                                : undefined
                            }
                          >
                            {AVAILABILITY_LABELS[status]}
                          </button>
                        </form>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <div className="portal-sessions-filter">
        <h2>Session-Recaps</h2>
        {recapYears.length > 0 && (
          <label className="portal-sessions-filter-control">
            <span>Datum</span>
            <select
              value={yearFilter}
              onChange={(event) => setYearFilter(event.target.value)}
              aria-label="Session-Recaps nach Jahr filtern"
            >
              <option value={YEAR_OPTIONS_ALL}>Alle Jahre</option>
              {recapYears.map((year) => (
                <option key={year} value={String(year)}>
                  {year}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <ul className="auth-page-list">
        {filteredRecaps.map((session) => {
          const date = parseSessionDate(session.dateIso);
          return (
            <li key={session.id}>
              <Link href={`/auth/worlds/${worldSlug}/sessions/${session.id}`}>
                <strong>
                  Session {session.sessionNumber}: {session.title}
                </strong>
                {date ? <span>{date.toLocaleDateString("de-DE")}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>

      {filteredRecaps.length === 0 && (
        <p>
          {yearFilter === YEAR_OPTIONS_ALL
            ? "Derzeit sind keine Session-Recaps veröffentlicht."
            : "Keine Session-Recaps für das gewählte Jahr."}
        </p>
      )}
    </>
  );
}
