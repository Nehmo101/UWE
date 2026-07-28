import Link from "next/link";
import {
  createLifeAdminService,
  PERSONAL_BRAIN_CATEGORIES,
  PERSONAL_BRAIN_CATEGORY_LABELS,
  prisma,
} from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import { getCurrentUser } from "@/src/lib/auth";
import { canEnterBrain } from "@/src/lib/owner";
import { BrainShell, BrainDenied } from "@/src/components/BrainShell";
import { LifeBrainIndexStatus } from "@/src/components/LifeBrainIndexStatus";
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

function formatDate(value: Date | undefined): string {
  // Die Suchtreffer liefern eine schlankere Form als die Listen — `updatedAt`
  // kann dort fehlen.
  return value
    ? value.toLocaleDateString("de-DE", { year: "numeric", month: "short", day: "numeric" })
    : "—";
}

interface Props {
  searchParams: Promise<{ q?: string; category?: string }>;
}

/**
 * Persönliches Wissen — Fakten und Dokumente in der owner-privaten Brain-DB.
 *
 * Studios `/life-brain` ist hier aufgegangen (Abschnitt H2): Suche mit
 * Kategoriefilter und die Index-Lage sind mitgekommen. Die Suche läuft
 * server-seitig über `searchPersonalBrain` statt über einen Client-Fetch — eine
 * Fläche weniger, die auf eine API zeigt.
 *
 * Der Chat lag in Studio unter `/life-brain/chat`; Brains `/ki-chat` kann mehr
 * (Unterhaltungen, Modellwahl, Anhänge, Diktat) und ersetzt ihn.
 */
export default async function BrainLifeBrainPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user || !canEnterBrain(user)) {
    return (
      <BrainShell active="/life-brain" title="Persönliches Brain">
        <BrainDenied />
      </BrainShell>
    );
  }

  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const category = params.category?.trim() || undefined;
  const filtering = Boolean(query || category);

  const service = createLifeAdminService(brainPrisma, prisma);
  const [allDocuments, allFacts, hits] = await Promise.all([
    service.listPersonalBrainDocuments({ limit: 100 }),
    service.listPersonalBrainFacts({ limit: 100 }),
    filtering
      ? service.searchPersonalBrain({ query: query || undefined, category, limit: 50 })
      : Promise.resolve(null),
  ]);

  const documents = hits ? hits.documents.map((hit) => hit.item) : allDocuments;
  const facts = hits ? hits.facts.map((hit) => hit.item) : allFacts;

  return (
    <BrainShell
      active="/life-brain"
      title="Persönliches Wissen"
      lede={`${allDocuments.length} Dokument(e) · ${allFacts.length} Fakt(en) — anlegen, festhalten, wiederfinden. Lokal auf deiner Hardware, niemals an Cloud-KI.`}
    >
      <form method="get" action="/life-brain" className="brain-form-row" role="search">
        <label>
          Suchen
          <input name="q" defaultValue={query} placeholder="Titel, Inhalt, Tag …" />
        </label>
        <label>
          Kategorie
          <select name="category" defaultValue={category ?? ""}>
            <option value="">Alle</option>
            {PERSONAL_BRAIN_CATEGORIES.map((entry) => (
              <option key={entry} value={entry}>
                {PERSONAL_BRAIN_CATEGORY_LABELS[entry] ?? entry}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="brain-btn brain-btn-sm">
          Suchen
        </button>
        {filtering ? (
          <Link className="brain-btn brain-btn-ghost brain-btn-sm" href="/life-brain">
            Zurücksetzen
          </Link>
        ) : null}
      </form>

      {filtering ? (
        <p className="brain-muted">
          {documents.length} Dokument(e) und {facts.length} Fakt(en) passen
          {query ? ` zu „${query}"` : ""}
          {category ? ` in ${PERSONAL_BRAIN_CATEGORY_LABELS[category] ?? category}` : ""}.
        </p>
      ) : null}

      <LifeBrainIndexStatus />
      <div
        style={{
          display: "grid",
          gap: "0.85rem",
          // min() statt 19rem: auf schmalen Displays darf die Spalte nie breiter
          // werden als der Inhaltsbereich, sonst laufen die Formulare heraus.
          gridTemplateColumns: "repeat(auto-fit, minmax(min(19rem, 100%), 1fr))",
        }}
      >
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
              <select name="category" defaultValue={category ?? PERSONAL_BRAIN_CATEGORIES[0]}>
                {PERSONAL_BRAIN_CATEGORIES.map((entry) => (
                  <option key={entry} value={entry}>
                    {PERSONAL_BRAIN_CATEGORY_LABELS[entry] ?? entry}
                  </option>
                ))}
              </select>
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
