import { createPersonalBrainService, prisma } from "@uwe/database/server";
import { reindexLifeBrainAction } from "@/app/life-brain-actions";

export async function LifeBrainIndexPanel() {
  const indexStatus = await createPersonalBrainService(prisma).getIndexStatusForDocuments();
  const documentCount = indexStatus.length;
  const indexedDocumentCount = indexStatus.filter((entry) => entry.embeddedCount > 0).length;
  const totalChunks = indexStatus.reduce((sum, entry) => sum + entry.chunkCount, 0);
  const embeddedChunks = indexStatus.reduce((sum, entry) => sum + entry.embeddedCount, 0);
  const pendingDocuments = indexStatus.filter(
    (entry) => entry.chunkCount === 0 || entry.embeddedCount < entry.chunkCount,
  ).length;

  return (
    <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
      <h2 className="uwe-v2-section-title">RTX-Index (lokal)</h2>
      <p className="uwe-dashboard-muted">
        Embeddings für semantische Suche und lokale KI — nur RTX, kein Cloud-Fallback.
      </p>
      <dl className="uwe-v2-stat-grid">
        <div>
          <dt>Dokumente</dt>
          <dd>{documentCount}</dd>
        </div>
        <div>
          <dt>Indexiert</dt>
          <dd>
            {indexedDocumentCount}/{documentCount || "—"}
          </dd>
        </div>
        <div>
          <dt>Chunks mit Embedding</dt>
          <dd>
            {embeddedChunks}/{totalChunks || "—"}
          </dd>
        </div>
        <div>
          <dt>Ausstehend</dt>
          <dd>{pendingDocuments}</dd>
        </div>
      </dl>
      {documentCount === 0 ? (
        <p className="uwe-dashboard-muted">Noch keine Dokumente zum Indexieren.</p>
      ) : (
        <form action={reindexLifeBrainAction}>
          <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary">
            Alle Dokumente neu indexieren
          </button>
        </form>
      )}
      {pendingDocuments > 0 && documentCount > 0 && (
        <p className="uwe-dashboard-muted" role="note">
          {pendingDocuments} Dokument(e) ohne vollständigen RTX-Index — Reindex startet einen
          Hintergrund-Job, wenn RTX erreichbar ist.
        </p>
      )}
    </section>
  );
}
