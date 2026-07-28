import {
  createDocumentTemplateService,
  DOCUMENT_TEMPLATE_CATEGORY_LABELS,
  type DocumentTemplate,
  type DocumentTemplateCategory,
} from "@uwe/database/server";
import { familyPrisma } from "@uwe/database/family-client";
import { getFamilyUser } from "@/src/lib/page-family";
import { FamilyShell, FamilyDenied } from "@/src/components/FamilyShell";
import {
  FamilyDocumentFiller,
  type FamilyTemplateDto,
} from "@/src/components/FamilyDocumentFiller";
import {
  createTemplateAction,
  deleteTemplateAction,
  updateTemplateAction,
} from "../documents-actions";

/**
 * Dokumente & Vorlagen (H9) — die einzige Fassung.
 *
 * Vorher zweimal vorhanden: Brain hatte die Verwaltung, Studio den Generator.
 * Hier steht beides zusammen, weil eine Vorlage ohne Ausfüllen nutzlos ist und
 * ein Generator ohne Vorlagenpflege genauso.
 */

export const dynamic = "force-dynamic";

const CATEGORY_ORDER: DocumentTemplateCategory[] = ["contract", "guide", "checklist", "other"];

function snippet(text: string, max = 160): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

function TemplateFields({ template }: { template?: DocumentTemplate }) {
  return (
    <>
      <div className="family-form-row">
        <label>
          Name
          <input
            name="name"
            defaultValue={template?.name ?? ""}
            required
            placeholder="z. B. Kündigungsschreiben"
          />
        </label>
        <label>
          Kategorie
          <select name="category" defaultValue={template?.category ?? "other"}>
            {CATEGORY_ORDER.map((value) => (
              <option key={value} value={value}>
                {DOCUMENT_TEMPLATE_CATEGORY_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Inhalt
        <textarea
          name="body"
          rows={6}
          defaultValue={template?.body ?? ""}
          placeholder={"Sehr geehrte Damen und Herren,\n\nhiermit kündige ich den Vertrag {{vertragsnummer}} zum {{datum}}."}
        />
      </label>
    </>
  );
}

export default async function FamilyDocumentsPage() {
  const user = await getFamilyUser();
  if (!user) {
    return (
      <FamilyShell active="/documents" title="Dokumente">
        <FamilyDenied />
      </FamilyShell>
    );
  }

  const templates = await createDocumentTemplateService(familyPrisma).listTemplates();
  const dtos: FamilyTemplateDto[] = templates.map((template) => ({
    id: template.id,
    name: template.name,
    category: template.category,
    body: template.body,
  }));

  return (
    <FamilyShell
      active="/documents"
      title="Dokumente & Vorlagen"
      eyebrow="Gemeinsamer Bereich"
      lede={`${templates.length} Vorlage(n). Platzhalter schreibst du als {{name}} — beim Ausfüllen wird daraus ein Feld.`}
    >
      <section className="family-section">
        <h2>Ausfüllen</h2>
        <FamilyDocumentFiller templates={dtos} />
      </section>

      <section className="family-section">
        <h2>Neue Vorlage</h2>
        <form action={createTemplateAction} className="family-form family-card">
          <TemplateFields />
          <div>
            <button type="submit" className="family-btn">
              Vorlage speichern
            </button>
          </div>
        </form>
      </section>

      {CATEGORY_ORDER.map((value) => {
        const items = templates.filter((template) => template.category === value);
        if (items.length === 0) return null;
        return (
          <section key={value} className="family-section">
            <h2>
              {DOCUMENT_TEMPLATE_CATEGORY_LABELS[value]} · {items.length}
            </h2>
            <ul className="family-list">
              {items.map((template) => (
                <li key={template.id} className="family-row">
                  <div className="family-row-head">
                    <strong>{template.name}</strong>
                    <form action={deleteTemplateAction} style={{ marginLeft: "auto" }}>
                      <input type="hidden" name="id" value={template.id} />
                      <button type="submit" className="family-btn family-btn-ghost family-btn-sm">
                        Löschen
                      </button>
                    </form>
                  </div>
                  {template.body ? <p className="family-muted">{snippet(template.body)}</p> : null}
                  <details className="family-edit">
                    <summary>Bearbeiten</summary>
                    <form action={updateTemplateAction} className="family-form">
                      <input type="hidden" name="id" value={template.id} />
                      <TemplateFields template={template} />
                      <div>
                        <button type="submit" className="family-btn family-btn-sm">
                          Speichern
                        </button>
                      </div>
                    </form>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </FamilyShell>
  );
}
