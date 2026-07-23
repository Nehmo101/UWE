import { createLifeAdminService, prisma } from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import { getCurrentUser } from "@/src/lib/auth";
import { isBrainOwner } from "@/src/lib/owner";
import { BrainShell, BrainDenied } from "@/src/components/BrainShell";
import {
  createBrainDocumentAction,
  createBrainFactAction,
  deleteBrainDocumentAction,
  deleteBrainFactAction,
  updateBrainDocumentAction,
  updateBrainFactAction,
} from "../brain-actions";

export const dynamic = "force-dynamic";

function snippet(text: string, max = 200): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

function tagStr(value: unknown): string {
  return Array.isArray(value) ? value.filter((t) => typeof t === "string").join(", ") : "";
}

function formatDate(value: Date): string {
  return value.toLocaleDateString("de-DE", { year: "numeric", month: "short", day: "numeric" });
}

/**
 * Personal knowledge base — owner-only, read AND write. Facts + documents are
 * stored in the owner-private brain DB and never leave the host.
 */
export default async function BrainLifeBrainPage() {
  const user = await getCurrentUser();
  if (!user || !isBrainOwner(user.role)) {
    return (
      <BrainShell active="/life-brain" title="Persönliches Brain">
        <BrainDenied />
      </BrainShell>
    );
  }

  const service = createLifeAdminService(brainPrisma, prisma);
  const [documents, facts] = await Promise.all([
    service.listPersonalBrainDocuments({ limit: 100 }),
    service.listPersonalBrainFacts({ limit: 100 }),
  ]);

  return (
    <BrainShell
      active="/life-brain"
      title="Persönliches Wissen"
      lede={`${documents.length} Dokument(e) · ${facts.length} Fakt(en) — anlegen, festhalten, wiederfinden. Lokal auf deiner Hardware, niemals an Cloud-KI.`}
    >
      <div style={{ display: "grid", gap: "0.85rem", gridTemplateColumns: "repeat(auto-fit, minmax(19rem, 1fr))" }}>
        <section className="brain-section">
          <h2>Neuer Fakt</h2>
          <form action={createBrainFactAction} className="brain-form brain-card">
            <label>
              Titel
              <input name="title" required placeholder="z. B. WLAN-Passwort Gäste" />
            </label>
            <label>
              Typ
              <input name="factType" defaultValue="custom" placeholder="custom, regel, kontakt …" />
            </label>
            <label>
              Inhalt
              <textarea name="content" rows={3} />
            </label>
            <label>
              Tags (kommagetrennt)
              <input name="tags" placeholder="netzwerk, zuhause" />
            </label>
            <div>
              <button type="submit" className="brain-btn">
                Fakt speichern
              </button>
            </div>
          </form>
        </section>

        <section className="brain-section">
          <h2>Neues Dokument</h2>
          <form action={createBrainDocumentAction} className="brain-form brain-card">
            <label>
              Titel
              <input name="title" required placeholder="z. B. Umzugs-Checkliste" />
            </label>
            <label>
              Kategorie
              <input name="category" placeholder="guide, checkliste, referenz …" />
            </label>
            <label>
              Inhalt
              <textarea name="content" rows={3} />
            </label>
            <label>
              Tags (kommagetrennt)
              <input name="tags" placeholder="planung, 2026" />
            </label>
            <div>
              <button type="submit" className="brain-btn">
                Dokument speichern
              </button>
            </div>
          </form>
        </section>
      </div>

      <section className="brain-section">
        <h2>Dokumente · {documents.length}</h2>
        {documents.length === 0 ? (
          <p className="brain-muted">Noch keine persönlichen Dokumente.</p>
        ) : (
          <ul className="brain-list">
            {documents.map((doc) => (
              <li key={doc.id} className="brain-row">
                <div className="brain-row-head">
                  <strong>{doc.title}</strong>
                  {doc.category ? <span className="brain-tag">{doc.category}</span> : null}
                  <span className="brain-muted">{formatDate(doc.updatedAt)}</span>
                  <form action={deleteBrainDocumentAction} style={{ marginLeft: "auto" }}>
                    <input type="hidden" name="id" value={doc.id} />
                    <button type="submit" className="brain-btn brain-btn-ghost brain-btn-sm">
                      Löschen
                    </button>
                  </form>
                </div>
                {doc.content ? <p style={{ margin: "0.35rem 0 0" }}>{snippet(doc.content)}</p> : null}
                <details className="brain-edit">
                  <summary>Bearbeiten</summary>
                  <form action={updateBrainDocumentAction} className="brain-form">
                    <input type="hidden" name="id" value={doc.id} />
                    <label>
                      Titel
                      <input name="title" defaultValue={doc.title} required />
                    </label>
                    <label>
                      Kategorie
                      <input name="category" defaultValue={doc.category ?? ""} />
                    </label>
                    <label>
                      Inhalt
                      <textarea name="content" rows={4} defaultValue={doc.content} />
                    </label>
                    <label>
                      Tags (kommagetrennt)
                      <input name="tags" defaultValue={tagStr(doc.tags)} />
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

      <section className="brain-section">
        <h2>Fakten · {facts.length}</h2>
        {facts.length === 0 ? (
          <p className="brain-muted">Noch keine persönlichen Fakten.</p>
        ) : (
          <ul className="brain-list">
            {facts.map((fact) => (
              <li key={fact.id} className="brain-row">
                <div className="brain-row-head">
                  <strong>{fact.title}</strong>
                  <span className="brain-tag">{fact.factType}</span>
                  <span className="brain-muted">{formatDate(fact.updatedAt)}</span>
                  <form action={deleteBrainFactAction} style={{ marginLeft: "auto" }}>
                    <input type="hidden" name="id" value={fact.id} />
                    <button type="submit" className="brain-btn brain-btn-ghost brain-btn-sm">
                      Löschen
                    </button>
                  </form>
                </div>
                {fact.content ? <p style={{ margin: "0.35rem 0 0" }}>{snippet(fact.content)}</p> : null}
                <details className="brain-edit">
                  <summary>Bearbeiten</summary>
                  <form action={updateBrainFactAction} className="brain-form">
                    <input type="hidden" name="id" value={fact.id} />
                    <label>
                      Titel
                      <input name="title" defaultValue={fact.title} required />
                    </label>
                    <label>
                      Typ
                      <input name="factType" defaultValue={fact.factType} />
                    </label>
                    <label>
                      Inhalt
                      <textarea name="content" rows={4} defaultValue={fact.content} />
                    </label>
                    <label>
                      Tags (kommagetrennt)
                      <input name="tags" defaultValue={tagStr(fact.tags)} />
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
