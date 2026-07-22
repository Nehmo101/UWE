import Link from "next/link";
import { createLifeAdminService, prisma } from "@uwe/database/server";
import { getCurrentUser } from "@/src/lib/auth";
import { isBrainOwner } from "@/src/lib/owner";
import { BrainNav } from "@/src/components/BrainNav";

export const dynamic = "force-dynamic";

function snippet(text: string, max = 200): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

function formatDate(value: Date): string {
  return value.toLocaleDateString("de-DE", { year: "numeric", month: "short", day: "numeric" });
}

/**
 * Pilot-migrated Brain surface: the personal knowledge base, served from the
 * owner-only Brain origin (:3002) and read through the shared @uwe/database
 * services. Owner-gated; private content never leaves the host / the Cloud.
 */
export default async function BrainLifeBrainPage() {
  const user = await getCurrentUser();
  if (!user || !isBrainOwner(user.role)) {
    return (
      <main className="page">
        <div className="card">
          <span className="eyebrow">Owner-only · lokal</span>
          <h1>Persönliches Brain</h1>
          <p>Dieser Bereich ist ausschließlich für den System-Owner.</p>
          <div className="footer">
            <Link href="/">← Zurück</Link>
          </div>
        </div>
      </main>
    );
  }

  const service = createLifeAdminService(prisma);
  const [documents, facts] = await Promise.all([
    service.listPersonalBrainDocuments({ limit: 100 }),
    service.listPersonalBrainFacts({ limit: 100 }),
  ]);

  return (
    <main className="page">
      <div className="card" style={{ maxWidth: "56rem" }}>
        <BrainNav active="/life-brain" />
        <span className="eyebrow">Owner-only · lokal · nie in der Cloud</span>
        <h1>Persönliches Brain</h1>
        <p>
          {documents.length} Dokument(e) · {facts.length} Fakt(en) — lokal auf deiner Hardware,
          niemals an Cloud-KI. Läuft auf dem eigenen Brain-Origin (Port 3002).
        </p>

        <section style={{ marginTop: "1.25rem" }}>
          <h2 style={{ fontSize: "1.05rem", margin: "0 0 0.5rem" }}>Dokumente</h2>
          {documents.length === 0 ? (
            <p>Noch keine persönlichen Dokumente.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.6rem" }}>
              {documents.map((doc) => (
                <li key={doc.id} className="brain-row">
                  <strong>{doc.title}</strong>
                  {doc.category ? <span className="brain-tag">{doc.category}</span> : null}
                  <span className="brain-muted"> · {formatDate(doc.updatedAt)}</span>
                  <p style={{ margin: "0.35rem 0 0" }}>{snippet(doc.content)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section style={{ marginTop: "1.5rem" }}>
          <h2 style={{ fontSize: "1.05rem", margin: "0 0 0.5rem" }}>Fakten</h2>
          {facts.length === 0 ? (
            <p>Noch keine persönlichen Fakten.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.6rem" }}>
              {facts.map((fact) => (
                <li key={fact.id} className="brain-row">
                  <strong>{fact.title}</strong>
                  <span className="brain-tag">{fact.factType}</span>
                  <span className="brain-muted"> · {formatDate(fact.updatedAt)}</span>
                  <p style={{ margin: "0.35rem 0 0" }}>{snippet(fact.content)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="footer">
          <Link href="/">← Brain-Start</Link>
        </div>
      </div>
    </main>
  );
}
