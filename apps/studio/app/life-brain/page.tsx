import Link from "next/link";
import { EmptyState } from "@uwe/shared-ui";
import { semanticSearchPersonalBrainChunks } from "@uwe/ai-brain";
import {
  createLifeAdminService,
  createPersonalBrainService,
  PERSONAL_BRAIN_CATEGORIES,
  PERSONAL_BRAIN_CATEGORY_LABELS,
  prisma,
  serializePersonalBrainRetrievalForPrompt,
} from "@uwe/database/server";
import { AdminModuleShell } from "@/components/AdminModuleShell";
import {
  createLifeBrainDocumentAction,
  createLifeBrainFactAction,
  deleteLifeBrainDocumentAction,
  deleteLifeBrainFactAction,
} from "../life-admin-actions";
import {
  indexLifeBrainDocumentAction,
  reindexLifeBrainAction,
} from "../life-brain-actions";

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function LifeBrainPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const lifeAdmin = createLifeAdminService(prisma);
  const personalBrain = createPersonalBrainService(prisma);

  const [documents, facts, indexStatus] = await Promise.all([
    lifeAdmin.listPersonalBrainDocuments({ limit: 100 }),
    lifeAdmin.listPersonalBrainFacts({ limit: 100 }),
    personalBrain.getIndexStatusForDocuments(),
  ]);

  const indexByDocumentId = new Map(indexStatus.map((entry) => [entry.documentId, entry]));

  let searchPreview: string | null = null;
  if (q?.trim()) {
    const results = await semanticSearchPersonalBrainChunks(personalBrain, {
      query: q.trim(),
      limit: 6,
    });
    searchPreview = serializePersonalBrainRetrievalForPrompt(
      results.map((entry) => ({
        documentTitle: entry.documentTitle,
        category: entry.category,
        content: entry.content,
        score: entry.score,
      })),
      [],
    );
  }

  return (
    <AdminModuleShell
      activePath="/life-brain"
      title="Persönliches Brain"
      summary="Life-Wissen lokal in UWE — semantisches Retrieval nur über RTX, niemals Cloud."
    >
      <p className="uwe-form-error" role="note">
        Privates Brain wird nur lokal gespeichert und darf nicht an Cloud-KI gesendet werden.
        Embeddings laufen über RTX — offline: Keyword-Fallback oder Job-Warteschlange.
      </p>

      <section className="uwe-card uwe-section">
        <h2 className="uwe-section-title">Retrieval testen</h2>
        <form method="get" className="uwe-brain-create-form">
          <label>
            Suchanfrage
            <input name="q" type="search" defaultValue={q ?? ""} placeholder="Homelab Router Backup …" />
          </label>
          <button type="submit" className="uwe-btn uwe-btn-secondary">
            Suchen
          </button>
        </form>
        {searchPreview && (
          <pre className="uwe-today-card uwe-life-brain-preview">{searchPreview}</pre>
        )}
        <form action={reindexLifeBrainAction}>
          <button type="submit" className="uwe-btn uwe-btn-secondary uwe-btn-sm">
            Alle Dokumente neu indizieren
          </button>
        </form>
      </section>

      <section className="uwe-card uwe-section">
        <h2 className="uwe-section-title">Neues Dokument</h2>
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
          <button type="submit" className="uwe-btn uwe-btn-primary">
            Dokument speichern
          </button>
        </form>
      </section>

      <section className="uwe-card uwe-section">
        <h2 className="uwe-section-title">Neuer Fakt</h2>
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
          <button type="submit" className="uwe-btn uwe-btn-secondary">
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
          <section className="uwe-section">
            <h2 className="uwe-section-title">Dokumente ({documents.length})</h2>
            <div className="uwe-today-card-list">
              {documents.map((doc) => {
                const status = indexByDocumentId.get(doc.id);
                return (
                  <article key={doc.id} className="uwe-today-card">
                    <h3>{doc.title}</h3>
                    <p className="uwe-dashboard-muted">
                      {doc.category ? PERSONAL_BRAIN_CATEGORY_LABELS[doc.category] ?? doc.category : "Allgemein"}
                      {status
                        ? ` · ${status.embeddedCount}/${status.chunkCount} Chunks eingebettet`
                        : " · noch nicht indiziert"}
                    </p>
                    {doc.content && <p>{doc.content}</p>}
                    <div className="uwe-inline-actions">
                      <form action={indexLifeBrainDocumentAction}>
                        <input type="hidden" name="documentId" value={doc.id} />
                        <button type="submit" className="uwe-btn uwe-btn-secondary uwe-btn-sm">
                          Indizieren
                        </button>
                      </form>
                      <form action={deleteLifeBrainDocumentAction}>
                        <input type="hidden" name="id" value={doc.id} />
                        <button type="submit" className="uwe-btn uwe-btn-secondary uwe-btn-sm">
                          Löschen
                        </button>
                      </form>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="uwe-section">
            <h2 className="uwe-section-title">Fakten ({facts.length})</h2>
            <div className="uwe-today-card-list">
              {facts.map((fact) => (
                <article key={fact.id} className="uwe-today-card">
                  <h3>{fact.title}</h3>
                  <p className="uwe-dashboard-muted">{fact.factType}</p>
                  {fact.content && <p>{fact.content}</p>}
                  <form action={deleteLifeBrainFactAction}>
                    <input type="hidden" name="id" value={fact.id} />
                    <button type="submit" className="uwe-btn uwe-btn-secondary uwe-btn-sm">
                      Löschen
                    </button>
                  </form>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </AdminModuleShell>
  );
}
