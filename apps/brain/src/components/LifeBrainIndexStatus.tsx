import {
  createConnectorService,
  createPersonalBrainService,
  prisma,
} from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";

/**
 * Index-Lage des Personal Brain — wie viele Dokumente sind eingebettet, und
 * kann der RTX-Host gerade überhaupt embedden.
 *
 * Lag als `LifeBrainIndexPanel` in Studio (Abschnitt H2). Reine Statusanzeige,
 * kein Secret, keine Inhalte — nur Zahlen und der Grund, falls die semantische
 * Suche gerade auf Stichwortsuche zurückfällt.
 */

type RtxState = "ready" | "offline" | "disabled" | "no-model";

const RTX_NOTES: Record<RtxState, string> = {
  ready: "RTX-Embeddings bereit",
  offline: "RTX-Host offline — Stichwortsuche als Rückfall",
  disabled: "Embeddings deaktiviert (BRAIN_EMBEDDINGS_ENABLED=false)",
  "no-model": "Kein Embedding-Modell auf dem Connector — Stichwortsuche als Rückfall",
};

export async function LifeBrainIndexStatus() {
  const [indexStatus, connector] = await Promise.all([
    createPersonalBrainService(brainPrisma).getIndexStatusForDocuments(),
    createConnectorService(prisma).summarize(),
  ]);

  const totalChunks = indexStatus.reduce((sum, entry) => sum + entry.chunkCount, 0);
  const embeddedChunks = indexStatus.reduce((sum, entry) => sum + entry.embeddedCount, 0);
  const pending = indexStatus.filter(
    (entry) => entry.chunkCount === 0 || entry.embeddedCount < entry.chunkCount,
  ).length;

  const embeddingsEnabled =
    process.env.BRAIN_EMBEDDINGS_ENABLED !== "false" &&
    process.env.BRAIN_EMBEDDINGS_ENABLED !== "0";
  const hasEmbeddingCapability = connector.availableCapabilities.includes("embedding_local");

  let state: RtxState = "ready";
  if (!embeddingsEnabled) state = "disabled";
  else if (connector.onlineCount === 0) state = "offline";
  else if (!hasEmbeddingCapability) state = "no-model";

  return (
    <section className="brain-section">
      <h2>Index</h2>
      <div className="brain-kpis">
        <div className="brain-kpi">
          <strong>{indexStatus.length}</strong>
          <span>Dokumente</span>
        </div>
        <div className="brain-kpi">
          <strong>{embeddedChunks}</strong>
          <span>von {totalChunks} Abschnitten eingebettet</span>
        </div>
        <div className="brain-kpi">
          <strong>{pending}</strong>
          <span>Dokumente ausstehend</span>
        </div>
      </div>
      <p className={state === "ready" ? "brain-muted" : "brain-callout brain-callout-warn"}>
        {RTX_NOTES[state]}
      </p>
    </section>
  );
}
