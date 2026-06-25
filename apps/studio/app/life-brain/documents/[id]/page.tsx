import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CAPTURE_TYPE_LABELS,
  createLifeAdminService,
  PERSONAL_BRAIN_CATEGORY_LABELS,
  prisma,
} from "@uwe/database/server";
import { AdminModuleShell } from "@/components/AdminModuleShell";
import {
  deleteLifeBrainDocumentAction,
  updateLifeBrainDocumentTagsAction,
} from "../../../life-admin-actions";

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

interface Props {
  params: Promise<{ id: string }>;
}

export default async function LifeBrainDocumentDetailPage({ params }: Props) {
  const { id } = await params;
  const service = createLifeAdminService(prisma);
  const detail = await service.getPersonalBrainDocumentDetail(id);

  if (!detail) {
    notFound();
  }

  const { document, tags, linkedCaptures } = detail;

  return (
    <AdminModuleShell
      activePath="/life-brain"
      title={document.title}
      summary="Life-Brain-Dokument — nur lokal, nicht für Cloud-KI."
      actions={
        <Link href="/life-brain" className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm">
          Zurück zur Suche
        </Link>
      }
    >
      <p className="uwe-form-error" role="note">
        Privates Brain wird nur lokal gespeichert und darf nicht an Cloud-KI gesendet werden.
      </p>

      <article className="uwe-v2-card uwe-v2-section">
        <p className="uwe-dashboard-muted">
          Kategorie:{" "}
          {document.category
            ? (PERSONAL_BRAIN_CATEGORY_LABELS[document.category] ?? document.category)
            : "Allgemein"}
          {" · "}
          Tags: {tags.length > 0 ? tags.join(", ") : "—"}
          {" · "}
          Aktualisiert: {DATE_FORMAT.format(document.updatedAt)}
          {" · "}
          Erstellt: {DATE_FORMAT.format(document.createdAt)}
        </p>

        {document.content && (
          <section className="uwe-v2-section">
            <h2 className="uwe-v2-section-title">Inhalt</h2>
            <p style={{ whiteSpace: "pre-wrap" }}>{document.content}</p>
          </section>
        )}

        {linkedCaptures.length > 0 && (
          <section className="uwe-v2-section">
            <h2 className="uwe-v2-section-title">Quellen / Captures</h2>
            <ul className="uwe-today-card-list">
              {linkedCaptures.map((capture) => (
                <li key={capture.id} className="uwe-today-card">
                  <strong>{capture.title}</strong>
                  <p className="uwe-dashboard-muted">
                    {CAPTURE_TYPE_LABELS[capture.captureType]} ·{" "}
                    {DATE_FORMAT.format(capture.capturedAt)}
                  </p>
                  {capture.content && <p>{capture.content}</p>}
                  {capture.url && (
                    <p>
                      <a href={capture.url} target="_blank" rel="noreferrer">
                        {capture.url}
                      </a>
                    </p>
                  )}
                  <Link href="/capture">Capture-Inbox</Link>
                </li>
              ))}
            </ul>
          </section>
        )}

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
      </article>
    </AdminModuleShell>
  );
}
