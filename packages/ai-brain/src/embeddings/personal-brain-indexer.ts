import type { PersonalBrainService } from "@uwe/database/server";
import { chunkBrainText, estimateTokenCount } from "./chunking";
import type { EmbeddingProvider } from "./types";
import { resolveBrainEmbeddingSettings } from "./settings";

export interface IndexPersonalBrainDocumentResult {
  documentId: string;
  chunkCount: number;
  embeddedCount: number;
  providerOnline: boolean;
  embeddingsEnabled: boolean;
  message: string;
}

export interface ReindexPersonalBrainResult {
  documentCount: number;
  chunkCount: number;
  embeddedCount: number;
  providerOnline: boolean;
  embeddingsEnabled: boolean;
  message: string;
}

export interface IndexPersonalBrainDocumentOptions {
  force?: boolean;
  useMock?: boolean;
}

export async function indexPersonalBrainDocument(
  service: PersonalBrainService,
  documentId: string,
  provider?: EmbeddingProvider,
  options?: IndexPersonalBrainDocumentOptions,
): Promise<IndexPersonalBrainDocumentResult> {
  const settings = resolveBrainEmbeddingSettings();
  const embeddingProvider =
    provider ??
    (await import("./provider")).createEmbeddingProvider({
      useMock: options?.useMock,
    });

  const document = await service.getDocumentById(documentId);
  if (!document) {
    throw new Error(`Life-Brain-Dokument ${documentId} nicht gefunden`);
  }

  const chunks = chunkBrainText(document.content, { includeTitle: document.title });
  if (chunks.length === 0) {
    await service.replaceDocumentChunks(documentId, []);
    return {
      documentId,
      chunkCount: 0,
      embeddedCount: 0,
      providerOnline: false,
      embeddingsEnabled: settings.enabled,
      message: "Leeres Dokument — keine Chunks erzeugt",
    };
  }

  let providerOnline = false;
  if (settings.enabled && embeddingProvider.id !== "disabled") {
    const health = await embeddingProvider.healthCheck();
    providerOnline = health.ok;
  }

  let embeddedCount = 0;
  const chunkRecords = [];

  for (const [chunkIndex, content] of chunks.entries()) {
    let embedding: number[] | undefined;

    if (settings.enabled && providerOnline) {
      try {
        embedding = await embeddingProvider.embedText(content);
        embeddedCount += 1;
      } catch (error) {
        if (!options?.force) {
          throw error;
        }
      }
    }

    chunkRecords.push({
      chunkIndex,
      content,
      tokenCount: estimateTokenCount(content),
      embedding,
    });
  }

  await service.replaceDocumentChunks(documentId, chunkRecords);

  let message = "Chunks gespeichert";
  if (!settings.enabled) {
    message = "Embeddings deaktiviert — Chunks ohne Vektoren gespeichert";
  } else if (!providerOnline) {
    message = "Maschinenraum offline — Chunks ohne Embeddings gespeichert (Keyword-Fallback aktiv)";
  } else if (embeddedCount === chunks.length) {
    message = "Dokument vollständig eingebettet";
  } else if (embeddedCount > 0) {
    message = "Teilweise eingebettet";
  }

  return {
    documentId,
    chunkCount: chunks.length,
    embeddedCount,
    providerOnline,
    embeddingsEnabled: settings.enabled,
    message,
  };
}

export async function reindexPersonalBrain(
  service: PersonalBrainService,
  provider?: EmbeddingProvider,
  options?: IndexPersonalBrainDocumentOptions,
): Promise<ReindexPersonalBrainResult> {
  const statuses = await service.getIndexStatusForDocuments();
  const documentIds = statuses.map((entry) => entry.documentId);

  let chunkCount = 0;
  let embeddedCount = 0;
  let providerOnline = false;
  const settings = resolveBrainEmbeddingSettings();

  for (const documentId of documentIds) {
    const result = await indexPersonalBrainDocument(service, documentId, provider, options);
    chunkCount += result.chunkCount;
    embeddedCount += result.embeddedCount;
    providerOnline = providerOnline || result.providerOnline;
  }

  return {
    documentCount: documentIds.length,
    chunkCount,
    embeddedCount,
    providerOnline,
    embeddingsEnabled: settings.enabled,
    message:
      documentIds.length === 0
        ? "Keine Life-Brain-Dokumente zum Indizieren"
        : `${documentIds.length} Dokument(e) indiziert`,
  };
}
