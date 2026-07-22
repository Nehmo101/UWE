import { createDocumentTemplateService } from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import { getBrainOwner } from "@/src/lib/page-owner";
import { BrainShell, BrainDenied } from "@/src/components/BrainShell";

export const dynamic = "force-dynamic";

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
    <BrainShell active="/documents" title="Dokumente & Vorlagen">
      <p>{templates.length} Vorlage(n) — Verträge, Guides, Checklisten; lokal, privat.</p>
      {templates.length === 0 ? (
        <p>Keine Vorlagen.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "1rem 0 0", display: "grid", gap: "0.6rem" }}>
          {templates.map((template) => (
            <li key={template.id} className="brain-row">
              <strong>{template.name}</strong>
              <span className="brain-tag">{template.category}</span>
              {template.body ? (
                <p style={{ margin: "0.35rem 0 0" }} className="brain-muted">
                  {snippet(template.body)}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </BrainShell>
  );
}
