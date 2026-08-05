import type { PortalPlayerNoteView } from "@uwe/database/server";
import { PlayerNoteStatusBadge } from "@uwe/shared-ui";
import {
  createPlayerNoteAction,
  submitPlayerNoteAction,
  updatePlayerNoteAction,
} from "../../app/note-actions";

interface PlayerNotesPanelProps {
  worldSlug: string;
  campaignId: string;
  notes: PortalPlayerNoteView[];
  currentUserId: string | null;
  canComment: boolean;
  pageId?: string;
  gameSessionId?: string;
  /**
   * Frei wählbarer Session-Bezug (F5): Liste der für Spieler sichtbaren
   * Sessions als Dropdown. Vorausgewählt ist die aktive Session
   * (`defaultSessionId`) — keine Auswahl nötig, „Ohne Session" ist explizit.
   * Nur wirksam, wenn kein festes `gameSessionId` gesetzt ist.
   */
  sessions?: Array<{ id: string; label: string }>;
  defaultSessionId?: string | null;
  returnPath: string;
}

export function PlayerNotesPanel({
  worldSlug,
  campaignId,
  notes,
  currentUserId,
  canComment,
  pageId,
  gameSessionId,
  sessions,
  defaultSessionId,
  returnPath,
}: PlayerNotesPanelProps) {
  return (
    <section className="auth-block auth-notes-panel">
      <h2>Kommentare &amp; Notizen</h2>

      {notes.length === 0 ? (
        <p className="auth-muted">Noch keine Notizen.</p>
      ) : (
        <ul className="auth-notes-list">
          {notes.map((note) => (
            <li key={note.id} className="auth-note-item">
              <header className="auth-note-header">
                <strong>{note.authorDisplayName}</strong>
                <PlayerNoteStatusBadge status={note.status} />
              </header>
              <p className="auth-note-content">{note.content}</p>
              {note.userId === currentUserId && note.status === "visible_to_dm" && (
                <p className="auth-muted">Wartet auf Review durch den Spielleiter.</p>
              )}
              {note.userId === currentUserId && note.status === "accepted" && (
                <p className="auth-muted">Vom Spielleiter übernommen oder freigegeben.</p>
              )}
              {note.userId === currentUserId && note.status === "draft" && (
                <div className="auth-note-actions">
                  <form action={submitPlayerNoteAction}>
                    <input type="hidden" name="worldSlug" value={worldSlug} />
                    <input type="hidden" name="noteId" value={note.id} />
                    <input type="hidden" name="returnPath" value={returnPath} />
                    <button type="submit" className="auth-btn auth-btn-small">
                      An GM senden
                    </button>
                  </form>
                  <details className="auth-note-edit">
                    <summary>Bearbeiten</summary>
                    <form action={updatePlayerNoteAction} className="auth-note-form">
                      <input type="hidden" name="worldSlug" value={worldSlug} />
                      <input type="hidden" name="noteId" value={note.id} />
                      <input type="hidden" name="returnPath" value={returnPath} />
                      <textarea name="content" defaultValue={note.content} rows={3} required />
                      <button type="submit" className="auth-btn auth-btn-small">
                        Speichern
                      </button>
                    </form>
                  </details>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {canComment ? (
        <form action={createPlayerNoteAction} className="auth-note-form">
          <input type="hidden" name="worldSlug" value={worldSlug} />
          <input type="hidden" name="campaignId" value={campaignId} />
          <input type="hidden" name="returnPath" value={returnPath} />
          {pageId && <input type="hidden" name="pageId" value={pageId} />}
          {gameSessionId ? (
            <input type="hidden" name="gameSessionId" value={gameSessionId} />
          ) : sessions && sessions.length > 0 ? (
            <>
              <label htmlFor="note-session">Session</label>
              <select
                id="note-session"
                name="gameSessionId"
                defaultValue={defaultSessionId ?? ""}
              >
                <option value="">Ohne Session</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.label}
                  </option>
                ))}
              </select>
            </>
          ) : null}
          <label htmlFor="note-content">Neue Notiz</label>
          <textarea
            id="note-content"
            name="content"
            rows={4}
            placeholder="Deine Beobachtung oder Frage an den GM…"
            required
          />
          <button type="submit" className="auth-btn">Als Entwurf speichern</button>
        </form>
      ) : (
        <p className="auth-muted">Anmelden als Spieler, um Notizen zu schreiben.</p>
      )}
    </section>
  );
}
