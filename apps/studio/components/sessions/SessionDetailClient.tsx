"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ViewEditToggle } from "@uwe/shared-ui";
import {
  GAME_SESSION_STATUS_LABELS,
  GameSessionStatusBadge,
  PageTypeBadge,
} from "@uwe/shared-ui";
import { buildPageUrl as dbBuildPageUrl } from "@uwe/database/page-types";
import type { DmGameSessionView } from "@uwe/database/server";
import {
  linkPageToSessionAction,
  publishSessionRecapAction,
  unlinkPageFromSessionAction,
  updateGameSessionAction,
} from "@/app/session-actions";
import { preparePrintListFromSessionAction } from "@/app/print-list-actions";

interface LinkablePage {
  id: string;
  title: string;
  type: string;
  slug: string;
}

interface Props {
  worldSlug: string;
  sessionId: string;
  session: DmGameSessionView;
  linkablePages: LinkablePage[];
  flash?: {
    saved?: string;
    published?: string;
    linked?: string;
    unlinked?: string;
  };
}

export function SessionDetailClient({
  worldSlug,
  sessionId,
  session,
  linkablePages,
  flash,
}: Props) {
  const router = useRouter();
  const [savedHint, setSavedHint] = useState<string | null>(null);

  const readView = (
    <article className="uwe-v2-card uwe-v2-card-padded">
      <p>
        <GameSessionStatusBadge status={session.status} />
        {session.date ? (
          <span className="uwe-dashboard-muted" style={{ marginLeft: "0.5rem" }}>
            {session.date.toLocaleDateString("de-DE")}
          </span>
        ) : null}
      </p>
      {session.summaryPlayer ? (
        <section className="uwe-v2-section">
          <h2 className="uwe-v2-section-title">Spieler-Recap</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{session.summaryPlayer}</p>
        </section>
      ) : null}
      {session.summaryDm ? (
        <section className="uwe-v2-section">
          <h2 className="uwe-v2-section-title">DM-Zusammenfassung</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{session.summaryDm}</p>
        </section>
      ) : null}
      {session.notes ? (
        <section className="uwe-v2-section">
          <h2 className="uwe-v2-section-title">Vorbereitungsnotizen</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{session.notes}</p>
        </section>
      ) : null}
      <div className="uwe-inline-actions uwe-v2-section">
        <Link
          href={`/worlds/${worldSlug}/prepare-session?sessionId=${sessionId}`}
          className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm"
        >
          Session vorbereiten →
        </Link>
        <Link
          href={`/worlds/${worldSlug}/sessions/${sessionId}/live`}
          className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm"
        >
          Live-Modus
        </Link>
      </div>
    </article>
  );

  const editView = (
    <>
      <form
        action={async (formData) => {
          await updateGameSessionAction(formData);
          setSavedHint("Gespeichert.");
          router.refresh();
        }}
        className="uwe-edit-form"
      >
        <input type="hidden" name="worldSlug" value={worldSlug} />
        <input type="hidden" name="sessionId" value={sessionId} />
        <label>
          Titel
          <input name="title" defaultValue={session.title} required />
        </label>
        <label>
          Session-Nummer
          <input name="sessionNumber" type="number" min={1} defaultValue={session.sessionNumber} required />
        </label>
        <label>
          Datum
          <input
            type="date"
            name="date"
            defaultValue={session.date ? session.date.toISOString().slice(0, 10) : ""}
          />
        </label>
        <label>
          Status
          <select name="status" defaultValue={session.status}>
            {(Object.keys(GAME_SESSION_STATUS_LABELS) as Array<keyof typeof GAME_SESSION_STATUS_LABELS>).map(
              (status) => (
              <option key={status} value={status}>
                {GAME_SESSION_STATUS_LABELS[status]}
              </option>
            ),
            )}
          </select>
        </label>
        <fieldset className="uwe-fieldset">
          <legend>DM-Notizen (nur Studio)</legend>
          <label>
            DM-Zusammenfassung
            <textarea name="summaryDm" rows={5} defaultValue={session.summaryDm ?? ""} />
          </label>
          <label>
            Vorbereitungsnotizen
            <textarea name="notes" rows={4} defaultValue={session.notes ?? ""} />
          </label>
        </fieldset>
        <label className="uwe-checkbox" style={{ marginTop: "1rem" }}>
          <input
            type="checkbox"
            name="playerVisibleSchedule"
            defaultChecked={session.playerVisibleSchedule}
          />
          Termin für Spieler im Portal ankündigen
        </label>
        <fieldset className="uwe-fieldset">
          <legend>Spieler-Recap</legend>
          <label>
            Recap für Spieler
            <textarea name="summaryPlayer" rows={5} defaultValue={session.summaryPlayer ?? ""} />
          </label>
        </fieldset>
        <fieldset className="uwe-fieldset">
          <legend>Nachbereitung</legend>
          <label>
            Offene Plots
            <textarea name="openPlots" rows={4} defaultValue={session.openPlots ?? ""} />
          </label>
          <label>
            Spielerentscheidungen
            <textarea name="playerDecisions" rows={4} defaultValue={session.playerDecisions ?? ""} />
          </label>
        </fieldset>
        <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
          Speichern
        </button>
        {savedHint ? <p className="uwe-dashboard-muted">{savedHint}</p> : null}
      </form>

      <section style={{ marginTop: "2rem" }}>
        <h2 className="uwe-dashboard-muted" style={{ fontSize: "1rem" }}>
          Verknüpfte Seiten
        </h2>
        {session.linkedPages.length > 0 ? (
          <ul className="uwe-linked-list">
            {session.linkedPages.map((page) => (
              <li key={page.id}>
                <Link href={dbBuildPageUrl(worldSlug, page.type, page.slug)}>{page.title}</Link>
                <PageTypeBadge type={page.type} />
                <form action={unlinkPageFromSessionAction} style={{ display: "inline" }}>
                  <input type="hidden" name="worldSlug" value={worldSlug} />
                  <input type="hidden" name="sessionId" value={sessionId} />
                  <input type="hidden" name="pageId" value={page.id} />
                  <button type="submit" className="uwe-v2-btn uwe-v2-btn-ghost uwe-v2-btn-sm">
                    Entfernen
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="uwe-v2-empty">Noch keine verknüpften Seiten.</p>
        )}
        {linkablePages.length > 0 && (
          <form action={linkPageToSessionAction} className="uwe-inline-form" style={{ marginTop: "1rem" }}>
            <input type="hidden" name="worldSlug" value={worldSlug} />
            <input type="hidden" name="sessionId" value={sessionId} />
            <select name="pageId" required>
              <option value="">Seite verknüpfen…</option>
              {linkablePages.map((page) => (
                <option key={page.id} value={page.id}>
                  {page.title} ({page.type})
                </option>
              ))}
            </select>
            <button type="submit" className="uwe-v2-btn uwe-v2-btn-ghost">
              Verknüpfen
            </button>
          </form>
        )}
      </section>
    </>
  );

  return (
    <>
      {flash?.saved && <p className="uwe-flash uwe-flash-success">Session gespeichert.</p>}
      {flash?.published && <p className="uwe-flash uwe-flash-success">Recap fürs Portal veröffentlicht.</p>}
      {flash?.linked && <p className="uwe-flash uwe-flash-success">Seite verknüpft.</p>}
      {flash?.unlinked && <p className="uwe-flash uwe-flash-success">Verknüpfung entfernt.</p>}

      {!session.recapPublished ? (
        <form action={publishSessionRecapAction} style={{ marginBottom: "1rem" }}>
          <input type="hidden" name="worldSlug" value={worldSlug} />
          <input type="hidden" name="sessionId" value={sessionId} />
          <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary uwe-v2-btn-sm">
            Fürs Portal veröffentlichen
          </button>
        </form>
      ) : null}

      <ViewEditToggle view={readView} edit={editView} />

      {session.linkedPages.length > 0 ? (
        <form action={preparePrintListFromSessionAction} className="uwe-form-inline uwe-v2-section">
          <input type="hidden" name="worldSlug" value={worldSlug} />
          <input type="hidden" name="sessionId" value={sessionId} />
          <input type="hidden" name="name" value={`${session.title} — Handouts`} />
          <label className="uwe-checkbox">
            <input type="checkbox" name="forNextSession" defaultChecked />
            Für nächste Session markieren
          </label>
          <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm">
            Druckliste vorbereiten
          </button>
        </form>
      ) : null}
    </>
  );
}
