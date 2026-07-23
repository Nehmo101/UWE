import { createDocumentTemplateService } from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import { getBrainOwner } from "@/src/lib/page-owner";
import { BrainShell, BrainDenied } from "@/src/components/BrainShell";
import {
  createTemplateAction,
  deleteTemplateAction,
  updateTemplateAction,
} from "../brain-actions";

export const dynamic = "force-dynamic";

const CATEGORY: Array<{ value: string; label: string }> = [
  { value: "contract", label: "Vertrag" },
  { value: "guide", label: "Guide" },
  { value: "checklist", label: "Checkliste" },
  { value: "other", label: "Sonstiges" },
];

function snippet(text: string, max = 160): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

export default async function BrainDocumentsPage() {
  const owner = await getBrainOwner();
  if (!owner) {
    return (
      <BrainShell active="/documents" title="Dokumente">
        <BrainDenied />
      </BrainShell>
    );
  }

  const templates = await createDocumentTemplateService(brainPrisma).listTemplates();

  return (
    <BrainShell
      active="/documents"
      title="Dokumente & Vorlagen"
      lede={`${templates.length} Vorlage(n) — Verträge, Guides, Checklisten. Wiederverwendbare Textbausteine, lokal & privat.`}
    >
      <section className="brain-section">
        <h2>Neue Vorlage</h2>
        <form action={createTemplateAction} className="brain-form brain-card">
          <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "2fr 1fr" }}>
            <label>
              Name
              <input name="name" required placeholder="z. B. Kündigungsschreiben" />
            </label>
            <label>
              Kategorie
              <select name="category" defaultValue="other">
                {CATEGORY.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Inhalt
            <textarea name="body" rows={4} placeholder="Textbaustein / Vorlage …" />
          </label>
          <div>
            <button type="submit" className="brain-btn">
              Vorlage speichern
            </button>
          </div>
        </form>
      </section>

      <section className="brain-section">
        <h2>Vorlagen · {templates.length}</h2>
        {templates.length === 0 ? (
          <p className="brain-muted">Keine Vorlagen.</p>
        ) : (
          <ul className="brain-list">
            {templates.map((template) => (
              <li key={template.id} className="brain-row">
                <div className="brain-row-head">
                  <strong>{template.name}</strong>
                  <span className="brain-tag">{template.category}</span>
                  <form action={deleteTemplateAction} style={{ marginLeft: "auto" }}>
                    <input type="hidden" name="id" value={template.id} />
                    <button type="submit" className="brain-btn brain-btn-ghost brain-btn-sm">
                      Löschen
                    </button>
                  </form>
                </div>
                {template.body ? (
                  <p style={{ margin: "0.35rem 0 0" }} className="brain-muted">
                    {snippet(template.body)}
                  </p>
                ) : null}
                <details className="brain-edit">
                  <summary>Bearbeiten</summary>
                  <form action={updateTemplateAction} className="brain-form">
                    <input type="hidden" name="id" value={template.id} />
                    <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "2fr 1fr" }}>
                      <label>
                        Name
                        <input name="name" defaultValue={template.name} required />
                      </label>
                      <label>
                        Kategorie
                        <select name="category" defaultValue={template.category}>
                          {CATEGORY.map((c) => (
                            <option key={c.value} value={c.value}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label>
                      Inhalt
                      <textarea name="body" rows={4} defaultValue={template.body ?? ""} />
                    </label>
                    <div>
                      <button type="submit" className="brain-btn brain-btn-sm">
                        Speichern
                      </button>
                    </div>
                  </form>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </BrainShell>
  );
}
