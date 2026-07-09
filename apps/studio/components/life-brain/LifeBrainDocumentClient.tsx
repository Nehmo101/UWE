"use client";

import Link from "next/link";
import { ViewEditToggle } from "@uwe/shared-ui";
import { AdminEntityLinksPanel } from "@/components/admin/AdminEntityLinksPanel";
import {
  updateLifeBrainDocumentAction,
  deleteLifeBrainDocumentAction,
  updateLifeBrainDocumentTagsAction,
} from "@/app/life-admin-actions";
import { indexLifeBrainDocumentAction } from "@/app/life-brain-actions";

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

interface LinkedCapture {
  id: string;
  title: string | null;
  captureType: string;
  capturedAt: Date;
  content: string | null;
  url: string | null;
}

interface Props {
  document: {
    id: string;
    title: string;
    category: string | null;
    content: string | null;
    updatedAt: Date;
    createdAt: Date;
  };
  categoryLabel: string;
  tags: string[];
  linkedCaptures: LinkedCapture[];
  captureTypeLabels: Record<string, string>;
}

export function LifeBrainDocumentClient({
  document,
  categoryLabel,
  tags,
  linkedCaptures,
  captureTypeLabels,
}: Props) {
  const readView = (
    <article className="uwe-v2-card uwe-v2-section">
      <p className="uwe-dashboard-muted">
        Kategorie: {categoryLabel} · Tags: {tags.length > 0 ? tags.join(", ") : "—"} · Aktualisiert:{" "}
        {DATE_FORMAT.format(document.updatedAt)}
      </p>
      {document.content ? (
        <section className="uwe-v2-section">
          <h2 className="uwe-v2-section-title">Inhalt</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{document.content}</p>
        </section>
      ) : null}
    </article>
  );

  const editView = (
    <>
      <form action={updateLifeBrainDocumentAction} className="uwe-form-grid uwe-v2-section">
        <input type="hidden" name="id" value={document.id} />
        <label>
          Titel
          <input name="title" defaultValue={document.title} required />
        </label>
        <label>
          Inhalt
          <textarea name="content" rows={12} defaultValue={document.content ?? ""} />
        </label>
        <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary uwe-v2-btn-sm">
          Speichern
        </button>
      </form>
      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Tags bearbeiten</h2>
        <form action={updateLifeBrainDocumentTagsAction} className="uwe-form-grid">
          <input type="hidden" name="id" value={document.id} />
          <label>
            Tags (kommagetrennt)
            <input name="tags" defaultValue={tags.join(", ")} placeholder="recht, vertrag" />
          </label>
          <div style={{ alignSelf: "end" }}>
            <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary uwe-v2-btn-sm">
              Tags speichern
            </button>
          </div>
        </form>
      </section>
      <form action={deleteLifeBrainDocumentAction}>
        <input type="hidden" name="id" value={document.id} />
        <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm">
          Dokument löschen
        </button>
      </form>
    </>
  );

  return (
    <>
      <ViewEditToggle view={readView} edit={editView} />
      {linkedCaptures.length > 0 && (
        <section className="uwe-v2-section">
          <h2 className="uwe-v2-section-title">Quellen / Captures</h2>
          <ul className="uwe-today-card-list">
            {linkedCaptures.map((capture) => (
              <li key={capture.id} className="uwe-today-card">
                <strong>
                  <Link href={`/capture/${capture.id}`}>{capture.title || "Capture"}</Link>
                </strong>
                <p className="uwe-dashboard-muted">
                  {captureTypeLabels[capture.captureType] ?? capture.captureType} ·{" "}
                  {DATE_FORMAT.format(capture.capturedAt)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
      <AdminEntityLinksPanel sourceType="personal_brain_document" sourceId={document.id} />
      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Indexierung</h2>
        <form action={indexLifeBrainDocumentAction}>
          <input type="hidden" name="documentId" value={document.id} />
          <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm">
            Embedding neu erzeugen
          </button>
        </form>
      </section>
    </>
  );
}
