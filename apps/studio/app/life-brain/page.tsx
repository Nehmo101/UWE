import Link from "next/link";
import { EmptyState } from "@uwe/shared-ui";
import {
  createLifeAdminService,
  parseStringArray,
  PERSONAL_BRAIN_CATEGORIES,
  PERSONAL_BRAIN_CATEGORY_LABELS,
  prisma,
} from "@uwe/database/server";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import {
  createLifeBrainDocumentAction,
  createLifeBrainFactAction,
  deleteLifeBrainDocumentAction,
  deleteLifeBrainFactAction,
} from "../life-admin-actions";

export default async function LifeBrainPage() {
  const service = createLifeAdminService(prisma);
  const [documents, facts] = await Promise.all([
    service.listPersonalBrainDocuments({ limit: 100 }),
    service.listPersonalBrainFacts({ limit: 100 }),
  ]);

  return (
    <StudioShell breadcrumb={<BreadcrumbTrail items={[{ label: "Persönliches Brain" }]} />}>
      <PageHeader
        title="Persönliches Brain"
        summary="Life-Wissen lokal in UWE — niemals an Cloud-KI. Getrennt vom DnD Brain."
      />
      <p className="uwe-form-error" role="note">
        Privates Brain wird nur lokal gespeichert und darf nicht an Cloud-KI gesendet werden.
      </p>

      <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
        <h2 className="uwe-v2-section-title">Neues Dokument</h2>
        <form action={createLifeBrainDocumentAction} className="uwe-brain-create-form">
          <label>
            Titel
            <input name="title" required />
          </label>
          <label>
            Kategorie
            <select name="category" defaultValue="personal_notes">
              {PERSONAL_BRAIN_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {PERSONAL_BRAIN_CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Inhalt
            <textarea name="content" rows={5} required />
          </label>
          <label>
            Tags (kommagetrennt)
            <input name="tags" placeholder="homelab, netzwerk" />
          </label>
          <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
            Dokument speichern
          </button>
        </form>
      </section>

      <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
        <h2 className="uwe-v2-section-title">Neuer Fakt</h2>
        <form action={createLifeBrainFactAction} className="uwe-brain-create-form">
          <label>
            Titel
            <input name="title" required />
          </label>
          <label>
            Typ
            <input name="factType" defaultValue="custom" />
          </label>
          <label>
            Inhalt
            <textarea name="content" rows={3} />
          </label>
          <label>
            Tags (kommagetrennt)
            <input name="tags" placeholder="material, 3d-print" />
          </label>
          <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary">
            Fakt speichern
          </button>
        </form>
      </section>

      {documents.length === 0 && facts.length === 0 ? (
        <EmptyState
          title="Noch keine Life-Brain-Einträge"
          description="Speichere persönliches Wissen lokal — getrennt vom DnD Brain."
          action={<Link href="/capture">Capture öffnen</Link>}
        />
      ) : (
        <>
          <section className="uwe-v2-section">
            <h2 className="uwe-v2-section-title">Dokumente ({documents.length})</h2>
            <div className="uwe-today-card-list">
              {documents.map((doc) => (
                <article key={doc.id} className="uwe-today-card">
                  <h3>{doc.title}</h3>
                  <p className="uwe-dashboard-muted">
                    {doc.category ? PERSONAL_BRAIN_CATEGORY_LABELS[doc.category] ?? doc.category : "Allgemein"}
                    {parseStringArray(doc.tags).length > 0 &&
                      ` · ${parseStringArray(doc.tags).join(", ")}`}
                  </p>
                  {doc.content && <p>{doc.content}</p>}
                  <form action={deleteLifeBrainDocumentAction}>
                    <input type="hidden" name="id" value={doc.id} />
                    <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm">
                      Löschen
                    </button>
                  </form>
                </article>
              ))}
            </div>
          </section>

          <section className="uwe-v2-section">
            <h2 className="uwe-v2-section-title">Fakten ({facts.length})</h2>
            <div className="uwe-today-card-list">
              {facts.map((fact) => (
                <article key={fact.id} className="uwe-today-card">
                  <h3>{fact.title}</h3>
                  <p className="uwe-dashboard-muted">
                    {fact.factType}
                    {parseStringArray(fact.tags).length > 0 &&
                      ` · ${parseStringArray(fact.tags).join(", ")}`}
                  </p>
                  {fact.content && <p>{fact.content}</p>}
                  <form action={deleteLifeBrainFactAction}>
                    <input type="hidden" name="id" value={fact.id} />
                    <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm">
                      Löschen
                    </button>
                  </form>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </StudioShell>
  );
}
