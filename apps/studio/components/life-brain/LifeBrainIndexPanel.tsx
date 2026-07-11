import { createConnectorService, createPersonalBrainService, prisma } from "@uwe/database/server";
import { reindexLifeBrainAction } from "@/app/life-brain-actions";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui";

export async function LifeBrainIndexPanel() {
  const [indexStatus, connectorSummary] = await Promise.all([
    createPersonalBrainService(prisma).getIndexStatusForDocuments(),
    createConnectorService(prisma).summarize(),
  ]);
  const documentCount = indexStatus.length;
  const indexedDocumentCount = indexStatus.filter((entry) => entry.embeddedCount > 0).length;
  const totalChunks = indexStatus.reduce((sum, entry) => sum + entry.chunkCount, 0);
  const embeddedChunks = indexStatus.reduce((sum, entry) => sum + entry.embeddedCount, 0);
  const pendingDocuments = indexStatus.filter(
    (entry) => entry.chunkCount === 0 || entry.embeddedCount < entry.chunkCount,
  ).length;

  const embeddingsEnabled =
    process.env.BRAIN_EMBEDDINGS_ENABLED !== "false" &&
    process.env.BRAIN_EMBEDDINGS_ENABLED !== "0";
  const connectorOnline = connectorSummary.onlineCount > 0;
  const embeddingCapability = connectorSummary.availableCapabilities.includes("embedding_local");
  const embeddingModel =
    connectorSummary.connectors
      .flatMap((entry) => entry.models ?? [])
      .find(
        (model) =>
          model.modelType === "embedding" || model.capabilities?.includes("embeddings"),
      )?.name ?? null;

  let rtxStatus: "ready" | "offline" | "disabled" | "no-model" = "ready";
  let rtxStatusNote = "RTX Embeddings bereit";
  if (!embeddingsEnabled) {
    rtxStatus = "disabled";
    rtxStatusNote = "Embeddings deaktiviert (BRAIN_EMBEDDINGS_ENABLED=false)";
  } else if (!connectorOnline) {
    rtxStatus = "offline";
    rtxStatusNote = "RTX Host Connector offline — Keyword-Fallback aktiv";
  } else if (!embeddingCapability) {
    rtxStatus = "no-model";
    rtxStatusNote =
      "Connector online, aber embedding_local fehlt — Ollama-Embedding-Modell am Connector prüfen";
  } else if (embeddingModel) {
    rtxStatusNote = `RTX bereit (${embeddingModel})`;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>RTX-Index (lokal)</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Embeddings für semantische Suche und lokale KI — nur RTX, kein Cloud-Fallback.
        </p>
        <Alert tone={rtxStatus === "ready" ? "success" : "warning"}>{rtxStatusNote}</Alert>
        <dl className="grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-4 text-sm [&_dd]:m-0 [&_dd]:text-lg [&_dd]:font-semibold [&_dt]:text-xs [&_dt]:text-muted-foreground">
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
          <p className="text-sm text-muted-foreground">Noch keine Dokumente zum Indexieren.</p>
        ) : (
          <form action={reindexLifeBrainAction}>
            <Button type="submit" variant="secondary">
              Alle Dokumente neu indexieren
            </Button>
          </form>
        )}
        {pendingDocuments > 0 && documentCount > 0 && (
          <p className="text-sm text-muted-foreground" role="note">
            {pendingDocuments} Dokument(e) ohne vollständigen RTX-Index — Reindex startet einen
            Hintergrund-Job, wenn RTX erreichbar ist.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
