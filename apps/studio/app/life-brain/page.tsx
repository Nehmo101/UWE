import Link from "next/link";
import { EmptyState } from "@uwe/shared-ui";
import {
  createLifeAdminService,
  parseStringArray,
  PERSONAL_BRAIN_CATEGORIES,
  PERSONAL_BRAIN_CATEGORY_LABELS,
  prisma,
} from "@uwe/database/server";
import { LifeBrainIndexPanel } from "@/components/life-brain/LifeBrainIndexPanel";
import { LifeBrainSearchPanel } from "@/components/life-brain/LifeBrainSearchPanel";
import { AdminCreateCard, AdminEntityForm, AdminModulePage, BreadcrumbTrail } from "@/src/components/admin";
import {
  createLifeBrainDocumentAction,
  createLifeBrainFactAction,
} from "../life-admin-actions";

function truncateContent(text: string, maxLength = 160): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

export default async function LifeBrainPage() {
  const service = createLifeAdminService(prisma);
  const [documents, facts] = await Promise.all([
    service.listPersonalBrainDocuments({ limit: 100 }),
    service.listPersonalBrainFacts({ limit: 100 }),
  ]);

  return (
    <AdminModulePage
      breadcrumb={<BreadcrumbTrail items={[{ label: "Persönliches Brain" }]} />}
      title="Persönliches Brain"
      summary="Life-Wissen lokal in UWE — niemals an Cloud-KI. Getrennt vom DnD Brain."
      headerActions={
        <Link href="/life-brain/chat" className="uwe-v2-btn uwe-v2-btn-secondary">
          Life-Brain Chat →
        </Link>
      }
    >
      <p className="uwe-form-error" role="note">
        Privates Brain wird nur lokal gespeichert und darf nicht an Cloud-KI gesendet werden.
      </p>
      <p className="uwe-inline-actions uwe-v2-section">
        <span className="uwe-badge uwe-badge-muted">RTX-only · Kein Cloud-Fallback</span>
      </p>

      <LifeBrainIndexPanel />
      <LifeBrainSearchPanel />

      <AdminCreateCard title="Neues Dokument">
        <AdminEntityForm
          action={createLifeBrainDocumentAction}
          submitLabel="Dokument speichern"
          fields={[
            { name: "title", label: "Titel", required: true },
            {
              name: "category",
              label: "Kategorie",
              type: "select",
              defaultValue: "personal_notes",
              options: PERSONAL_BRAIN_CATEGORIES.map((category) => ({
                value: category,
                label: PERSONAL_BRAIN_CATEGORY_LABELS[category],
              })),
            },
            { name: "content", label: "Inhalt", type: "textarea", rows: 5, required: true },
            {
              name: "tags",
              label: "Tags (kommagetrennt)",
              placeholder: "homelab, netzwerk",
            },
          ]}
        />
      </AdminCreateCard>

      <AdminCreateCard title="Neuer Fakt">
        <AdminEntityForm
          action={createLifeBrainFactAction}
          submitLabel="Fakt speichern"
          submitClassName="uwe-v2-btn uwe-v2-btn-secondary"
          fields={[
            { name: "title", label: "Titel", required: true },
            { name: "factType", label: "Typ", defaultValue: "custom" },
            { name: "content", label: "Inhalt", type: "textarea", rows: 3 },
            {
              name: "tags",
              label: "Tags (kommagetrennt)",
              placeholder: "material, 3d-print",
            },
          ]}
        />
      </AdminCreateCard>

      {documents.length === 0 && facts.length === 0 ? (
        <EmptyState
          title="Noch keine Life-Brain-Einträge"
          description="Speichere persönliches Wissen lokal — getrennt vom DnD Brain. Starte mit einem Dokument oben, erfasse per Capture oder nutze den Life-Brain Chat."
          action={
            <>
              <Link href="/capture">Capture öffnen</Link>
              {" · "}
              <Link href="/life-brain/chat">Life-Brain Chat</Link>
            </>
          }
        />
      ) : (
        <>
          <section className="uwe-v2-section">
            <h2 className="uwe-v2-section-title">Dokumente ({documents.length})</h2>
            <div className="uwe-today-card-list">
              {documents.map((doc) => (
                <article key={doc.id} className="uwe-today-card">
                  <h3>
                    <Link href={`/life-brain/documents/${doc.id}`}>{doc.title}</Link>
                  </h3>
                  <p className="uwe-dashboard-muted">
                    {doc.category ? PERSONAL_BRAIN_CATEGORY_LABELS[doc.category] ?? doc.category : "Allgemein"}
                    {parseStringArray(doc.tags).length > 0 &&
                      ` · ${parseStringArray(doc.tags).join(", ")}`}
                  </p>
                  {doc.content && <p>{truncateContent(doc.content)}</p>}
                  <p>
                    <Link href={`/life-brain/documents/${doc.id}`}>Details →</Link>
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="uwe-v2-section">
            <h2 className="uwe-v2-section-title">Fakten ({facts.length})</h2>
            <div className="uwe-today-card-list">
              {facts.map((fact) => (
                <article key={fact.id} className="uwe-today-card">
                  <h3>
                    <Link href={`/life-brain/facts/${fact.id}`}>{fact.title}</Link>
                  </h3>
                  <p className="uwe-dashboard-muted">
                    {fact.factType}
                    {parseStringArray(fact.tags).length > 0 &&
                      ` · ${parseStringArray(fact.tags).join(", ")}`}
                  </p>
                  {fact.content && <p>{truncateContent(fact.content)}</p>}
                  <p>
                    <Link href={`/life-brain/facts/${fact.id}`}>Details →</Link>
                  </p>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </AdminModulePage>
  );
}
