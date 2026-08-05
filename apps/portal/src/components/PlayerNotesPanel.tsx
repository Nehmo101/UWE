import {
  PLAYER_NOTE_CATEGORIES,
  PLAYER_NOTE_CATEGORY_LABELS,
  type PortalPlayerNoteView,
} from "@uwe/database/server";
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
  returnPath: string;
}

const SESSION_DATE_FORMAT = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

function toDateInputValue(value: Date | null): string {
  if (!value) return "";
  const date = new Date(value);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Titel in der Liste: die Überschrift, sonst die erste Zeile des Inhalts. */
export function noteListTitle(note: Pick<PortalPlayerNoteView, "title" | "content">): string {
  if (note.title?.trim()) return note.title.trim();
  const firstLine = note.content.split("\n").find((line) => line.trim());
  return firstLine?.trim().slice(0, 80) || "Notiz";
}

/**
 * Notizen schreiben und pflegen — mit Titel, Kategorie und Spielabend-Datum.
 *
 * Die drei Felder machen aus dem Zettelkasten ein Logbuch: das Datum sagt,
 * unter welchem Abend die Notiz steht (vorbelegt mit heute), die Kategorie
 * macht die Liste filterbar, der Titel macht sie überfliegbar. Alles drei
 * ist optional gehalten — eine schnelle Notiz am Tisch bleibt zwei Felder
 * und ein Knopf.
 */
export function PlayerNotesPanel({
  worldSlug,
  campaignId,
  notes,
  currentUserId,
  canComment,
  pageId,
  gameSessionId,
  returnPath,
}: PlayerNotesPanelProps) {
  const today = toDateInputValue(new Date());

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
                <strong>{noteListTitle(note)}</strong>
                <PlayerNoteStatusBadge status={note.status} />
              </header>
              <p className="auth-muted">
                {note.authorDisplayName}
                {" · "}
                {PLAYER_NOTE_CATEGORY_LABELS[note.category]}
                {note.sessionDate
                  ? ` · Spielabend ${SESSION_DATE_FORMAT.format(new Date(note.sessionDate))}`
                  : null}
                {note.sessionTitle ? ` · ${note.sessionTitle}` : null}
              </p>
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
                      <label>
                        Titel
                        <input
                          type="text"
                          name="title"
                          defaultValue={note.title ?? ""}
                          maxLength={200}
                        />
                      </label>
                      <label>
                        Kategorie
                        <select name="category" defaultValue={note.category}>
                          {PLAYER_NOTE_CATEGORIES.map((category) => (
                            <option key={category} value={category}>
                              {PLAYER_NOTE_CATEGORY_LABELS[category]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Spielabend
                        <input
                          type="date"
                          name="sessionDate"
                          defaultValue={toDateInputValue(note.sessionDate)}
                        />
                      </label>
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
          {gameSessionId && <input type="hidden" name="gameSessionId" value={gameSessionId} />}
          <label htmlFor="note-title">Titel (optional)</label>
          <input
            id="note-title"
            type="text"
            name="title"
            maxLength={200}
            placeholder="z. B. Der Händler mit der Narbe"
          />
          <div className="auth-note-form-row">
            <label htmlFor="note-category">
              Kategorie
              <select id="note-category" name="category" defaultValue="session">
                {PLAYER_NOTE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {PLAYER_NOTE_CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="note-session-date">
              Spielabend
              <input id="note-session-date" type="date" name="sessionDate" defaultValue={today} />
            </label>
          </div>
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
