import Link from "next/link";
import { EmptyState } from "@uwe/shared-ui";
import {
  createLifeAdminService,
  PERSONAL_BRAIN_CATEGORIES,
  PERSONAL_BRAIN_CATEGORY_LABELS,
  parsePersonalBrainTags,
  prisma,
} from "@uwe/database/server";
import { AdminModuleShell } from "@/components/AdminModuleShell";
import {
  createLifeBrainDocumentAction,
  createLifeBrainFactAction,
  deleteLifeBrainDocumentAction,
  deleteLifeBrainFactAction,
} from "../life-admin-actions";

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

interface Props {
  searchParams: Promise<{
    q?: string;
    category?: string;
    factType?: string;
    tag?: string;
  }>;
}

export default async function LifeBrainPage({ searchParams }: Props) {
  const filters = await searchParams;
  const query = filters.q?.trim() ?? "";
  const category = filters.category?.trim() || undefined;
  const factType = filters.factType?.trim() || undefined;
  const tag = filters.tag?.trim() || undefined;

  const service = createLifeAdminService(prisma);
  const [searchResult, allTags] = await Promise.all([
    service.searchPersonalBrain({
      query: query || undefined,
      category,
      factType,
      tag,
      limit: 50,
    }),
    service.listPersonalBrainTags(),
  ]);

  const documents = searchResult.documents;
  const facts = searchResult.facts;
  const hasFilters = Boolean(query || category || factType || tag);
  const isEmpty = documents.length === 0 && facts.length === 0;

  return (
    <AdminModuleShell
      activePath="/life-brain"
      title="Persönliches Brain"
      summary="Life-Wissen lokal in UWE — durchsuchbar, getrennt vom DnD Brain."
      bottomNav="search"
    >
      <p className="uwe-form-error" role="note">
        Privates Brain wird nur lokal gespeichert und darf nicht an Cloud-KI gesendet werden.
      </p>

      <section className="uwe-card uwe-section">
        <h2 className="uwe-section-title">Suche & Filter</h2>
        <form method="get" className="uwe-brain-create-form">
          <label>
            Stichwort
            <input name="q" defaultValue={query} placeholder="Homelab, Filament, Vertrag…" />
          </label>
          <label>
            Kategorie
            <select name="category" defaultValue={category ?? ""}>
              <option value="">Alle Kategorien</option>
              {PERSONAL_BRAIN_CATEGORIES.map((entry) => (
                <option key={entry} value={entry}>
                  {PERSONAL_BRAIN_CATEGORY_LABELS[entry]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tag
            <input name="tag" list="life-brain-tags" defaultValue={tag ?? ""} placeholder="optional" />
            <datalist id="life-brain-tags">
              {allTags.map((entry) => (
                <option key={entry} value={entry} />
              ))}
            </datalist>
          </label>
          <label>
            Fakt-Typ
            <input name="factType" defaultValue={factType ?? ""} placeholder="z. B. material" />
          </label>
          <div className="uwe-inline-actions">
            <button type="submit" className="uwe-btn uwe-btn-primary">
              Suchen
            </button>
            {hasFilters && (
              <Link href="/life-brain" className="uwe-btn uwe-btn-secondary">
                Filter zurücksetzen
              </Link>
            )}
          </div>
        </form>
        <p className="uwe-dashboard-muted">
          Lokaler Agent-Kontext: <code>GET /api/life-brain/context?q=…</code> (nur RTX, Studio-Auth)
        </p>
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
              {PERSONAL_BRAIN_CATEGORIES.map((entry) => (
                <option key={entry} value={entry}>
                  {PERSONAL_BRAIN_CATEGORY_LABELS[entry]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tags (kommagetrennt)
            <input name="tags" placeholder="homelab, 3d-druck" />
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
            Tags (kommagetrennt)
            <input name="tags" placeholder="rezept, filament" />
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

      {isEmpty ? (
        <EmptyState
          title={hasFilters ? "Keine Treffer" : "Noch keine Life-Brain-Einträge"}
          description={
            hasFilters
              ? "Passe Stichwort oder Filter an — oder lege einen neuen Eintrag an."
              : "Speichere persönliches Wissen lokal — getrennt vom DnD Brain."
          }
          action={<Link href="/capture">Capture öffnen</Link>}
        />
      ) : (
        <>
          <section className="uwe-section">
            <h2 className="uwe-section-title">
              Dokumente ({documents.length}
              {hasFilters ? " Treffer" : ""})
            </h2>
            <div className="uwe-today-card-list">
              {documents.map(({ item: doc, score, matchMode }) => (
                <article key={doc.id} className="uwe-today-card">
                  <h3>
                    <Link href={`/life-brain/documents/${doc.id}`}>{doc.title}</Link>
                  </h3>
                  <p className="uwe-dashboard-muted">
                    {doc.category
                      ? (PERSONAL_BRAIN_CATEGORY_LABELS[doc.category] ?? doc.category)
                      : "Allgemein"}
                    {parsePersonalBrainTags(doc.tags).length > 0 &&
                      ` · ${parsePersonalBrainTags(doc.tags).join(", ")}`}
                    {" · "}
                    {DATE_FORMAT.format(doc.updatedAt)}
                    {query && ` · ${matchMode} ${Math.round(score * 100)}%`}
                  </p>
                  {doc.content && <p>{doc.content.slice(0, 240)}</p>}
                  <div className="uwe-inline-actions">
                    <Link
                      href={`/life-brain/documents/${doc.id}`}
                      className="uwe-btn uwe-btn-secondary uwe-btn-sm"
                    >
                      Details
                    </Link>
                    <form action={deleteLifeBrainDocumentAction}>
                      <input type="hidden" name="id" value={doc.id} />
                      <button type="submit" className="uwe-btn uwe-btn-secondary uwe-btn-sm">
                        Löschen
                      </button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="uwe-section">
            <h2 className="uwe-section-title">
              Fakten ({facts.length}
              {hasFilters ? " Treffer" : ""})
            </h2>
            <div className="uwe-today-card-list">
              {facts.map(({ item: fact, score, matchMode }) => (
                <article key={fact.id} className="uwe-today-card">
                  <h3>
                    <Link href={`/life-brain/facts/${fact.id}`}>{fact.title}</Link>
                  </h3>
                  <p className="uwe-dashboard-muted">
                    {fact.factType}
                    {parsePersonalBrainTags(fact.tags).length > 0 &&
                      ` · ${parsePersonalBrainTags(fact.tags).join(", ")}`}
                    {" · "}
                    {DATE_FORMAT.format(fact.updatedAt)}
                    {query && ` · ${matchMode} ${Math.round(score * 100)}%`}
                  </p>
                  {fact.content && <p>{fact.content.slice(0, 240)}</p>}
                  <div className="uwe-inline-actions">
                    <Link
                      href={`/life-brain/facts/${fact.id}`}
                      className="uwe-btn uwe-btn-secondary uwe-btn-sm"
                    >
                      Details
                    </Link>
                    <form action={deleteLifeBrainFactAction}>
                      <input type="hidden" name="id" value={fact.id} />
                      <button type="submit" className="uwe-btn uwe-btn-secondary uwe-btn-sm">
                        Löschen
                      </button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </AdminModuleShell>
  );
}
