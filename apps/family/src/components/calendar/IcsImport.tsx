"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * ICS-Datei in den Kalender übernehmen — in zwei Schritten.
 *
 * Erst Vorschau, dann Übernahme: eine Kalenderdatei aus der Schule oder vom
 * Verein bringt gern hundert Termine mit, und was davon in den Haushalt soll,
 * entscheidet der Mensch. Nichts wird automatisch geschrieben — dasselbe
 * Prinzip wie beim Kassenbon im Scan-Eingang.
 *
 * Client-Komponente, weil die Datei zwischen beiden Schritten im Speicher der
 * Seite bleibt: die Auswahl geht an den Server, den Inhalt liest er beim
 * Übernehmen erneut aus der mitgeschickten Datei.
 *
 * Die Typen sind hier nachgebaut statt aus `@uwe/family-core` importiert — das
 * Paket ist server-seitig (`node:crypto`) und hat im Browser-Bündel nichts zu
 * suchen.
 */

export interface IcsImportMember {
  id: string;
  displayName: string;
  colour: string;
}

type ImportStatus = "new" | "update" | "duplicate";

interface PreviewItem {
  event: {
    importUid: string;
    title: string;
    location: string | null;
    startAt: string;
    endAt: string | null;
    allDay: boolean;
    recurring: boolean;
  };
  status: ImportStatus;
}

interface Preview {
  items: PreviewItem[];
  selection: string[];
  counts: { total: number; new: number; update: number; duplicate: number };
  skipped: number;
  truncated: boolean;
}

const STATUS_LABEL: Record<ImportStatus, string> = {
  new: "neu",
  update: "erneut eingelesen",
  duplicate: "schon im Kalender",
};

function formatWhen(iso: string, allDay: boolean): string {
  return new Date(iso).toLocaleString("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(allDay ? {} : { hour: "2-digit", minute: "2-digit" }),
  });
}

export function IcsImport({ members }: { members: readonly IcsImportMember[] }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function reset(next: File | null) {
    setFile(next);
    setPreview(null);
    setSelected(new Set());
    setError(null);
    setDone(null);
  }

  async function post(path: string, body: FormData): Promise<Response> {
    return fetch(path, { method: "POST", body, headers: { Accept: "application/json" } });
  }

  async function loadPreview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;

    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await post("/api/calendar/import/preview", body);
      const data = (await response.json()) as Preview & { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Die Datei konnte nicht gelesen werden.");
        setPreview(null);
        return;
      }
      setPreview(data);
      setSelected(new Set(data.selection));
    } catch {
      setError("Die Datei konnte nicht gelesen werden.");
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!file || selected.size === 0) return;

    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      for (const uid of selected) body.append("uids", uid);
      for (const id of memberIds) body.append("memberIds", id);

      const response = await post("/api/calendar/import", body);
      const data = (await response.json()) as {
        created?: number;
        updated?: number;
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "Die Termine konnten nicht übernommen werden.");
        return;
      }
      setDone(
        `${data.created ?? 0} Termin(e) angelegt, ${data.updated ?? 0} aktualisiert.`,
      );
      setPreview(null);
      setFile(null);
      setSelected(new Set());
      router.refresh();
    } catch {
      setError("Die Termine konnten nicht übernommen werden.");
    } finally {
      setBusy(false);
    }
  }

  function toggle(set: Set<string>, value: string): Set<string> {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  }

  return (
    <>
      <form onSubmit={loadPreview} className="family-form family-card">
        <label>
          Kalenderdatei (.ics)
          <input
            name="file"
            type="file"
            accept=".ics,text/calendar"
            required
            onChange={(event) => reset(event.currentTarget.files?.[0] ?? null)}
          />
        </label>
        <div>
          <button type="submit" className="family-btn" disabled={!file || busy}>
            {busy && !preview ? "Liest…" : "Datei ansehen"}
          </button>
        </div>
        {error ? <p className="family-muted">{error}</p> : null}
        {done ? <p className="family-muted">{done}</p> : null}
      </form>

      {preview ? (
        <section className="family-section">
          <h2>Vorschau · {preview.counts.total} Termin(e)</h2>
          <p className="family-muted">
            {preview.counts.new} neu, {preview.counts.update} erneut eingelesen,{" "}
            {preview.counts.duplicate} schon im Kalender.
            {preview.skipped > 0 ? ` ${preview.skipped} Eintrag/Einträge ohne Titel oder Beginn übersprungen.` : ""}
            {preview.truncated ? " Die Datei enthält mehr Termine, als ein Durchgang übernimmt." : ""}
          </p>

          {members.length > 0 ? (
            <fieldset className="family-form-inline">
              <legend>Wen betreffen die Termine?</legend>
              {members.map((member) => (
                <label key={member.id} className="family-check">
                  <input
                    type="checkbox"
                    checked={memberIds.has(member.id)}
                    onChange={() => setMemberIds((current) => toggle(current, member.id))}
                  />
                  <span
                    className="family-member-dot"
                    style={{ backgroundColor: member.colour }}
                    aria-hidden
                  />
                  {member.displayName}
                </label>
              ))}
            </fieldset>
          ) : null}

          <ul className="family-list">
            {preview.items.map(({ event, status }) => (
              <li key={event.importUid} className="family-row">
                <label className="family-check">
                  <input
                    type="checkbox"
                    checked={selected.has(event.importUid)}
                    onChange={() => setSelected((current) => toggle(current, event.importUid))}
                  />
                  <strong>{event.title}</strong>
                  <span
                    className={
                      status === "duplicate" ? "family-tag family-tag-warn" : "family-tag"
                    }
                  >
                    {STATUS_LABEL[status]}
                  </span>
                  {event.recurring ? (
                    <span className="family-tag family-tag-warn">
                      Serie · nur der erste Termin
                    </span>
                  ) : null}
                  <span className="family-muted">
                    {formatWhen(event.startAt, event.allDay)}
                    {event.location ? ` · ${event.location}` : ""}
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <div className="family-form-row">
            <button
              type="button"
              className="family-btn"
              onClick={apply}
              disabled={busy || selected.size === 0}
            >
              {busy ? "Übernimmt…" : `${selected.size} Termin(e) übernehmen`}
            </button>
            <button
              type="button"
              className="family-btn family-btn-ghost"
              onClick={() => reset(file)}
              disabled={busy}
            >
              Verwerfen
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}
