import type { BrainStoreService } from "@uwe/database/server";
import { chunkBrainText, estimateTokenCount } from "./chunking";
import type { EmbeddingProvider } from "./types";
import type { IndexBrainDocumentResult, ReindexBrainWorldResult } from "./types";
import { BrainEmbeddingOfflineError } from "./types";
import { resolveBrainEmbeddingSettings } from "./settings";

export interface IndexBrainDocumentOptions {
  force?: boolean;
  useMock?: boolean;
}

export async function indexBrainDocument(
  brainStore: BrainStoreService,
  documentId: string,
  provider?: EmbeddingProvider,
  options?: IndexBrainDocumentOptions,
): Promise<IndexBrainDocumentResult> {
  const settings = resolveBrainEmbeddingSettings();
  const embeddingProvider =
    provider ??
    (await import("./provider")).createEmbeddingProvider({
      useMock: options?.useMock,
    });

  const document = await brainStore.getDocumentById(documentId);
  if (!document) {
    throw new Error(`Brain-Dokument ${documentId} nicht gefunden`);
  }

  const chunks = chunkBrainText(document.content, { includeTitle: document.title });
  if (chunks.length === 0) {
    await brainStore.replaceDocumentChunks(documentId, []);
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

  await brainStore.replaceDocumentChunks(documentId, chunkRecords);

  let message = "Chunks gespeichert";
  if (!settings.enabled) {
    message = "Embeddings deaktiviert — Chunks ohne Vektoren gespeichert";
  } else if (!providerOnline) {
    message = "Embedding-Provider offline — Chunks ohne Vektoren gespeichert";
  } else if (embeddedCount === chunks.length) {
    message = "Chunks indexiert und in UWE gespeichert";
  } else if (embeddedCount > 0) {
    message = "Teilweise indexiert — einige Chunks ohne Vektoren";
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

export interface ReindexBrainWorldOptions extends IndexBrainDocumentOptions {
  campaignId?: string | null;
}

export async function reindexBrainWorld(
  brainStore: BrainStoreService,
  worldSlug: string,
  provider?: EmbeddingProvider,
  options?: ReindexBrainWorldOptions,
): Promise<ReindexBrainWorldResult> {
  const settings = resolveBrainEmbeddingSettings();
  const embeddingProvider =
    provider ??
    (await import("./provider")).createEmbeddingProvider({
      useMock: options?.useMock,
    });

  const documents = await brainStore.listDocuments(worldSlug, {
    campaignId: options?.campaignId,
  });

  let providerOnline = false;
  if (settings.enabled && embeddingProvider.id !== "disabled") {
    const health = await embeddingProvider.healthCheck();
    providerOnline = health.ok;
    if (!providerOnline && !options?.force) {
      throw new BrainEmbeddingOfflineError(
        "Reindex abgebrochen — Maschinenraum-Embedding-Provider offline",
      );
    }
  }

  const errors: Array<{ documentId: string; message: string }> = [];
  let indexedCount = 0;
  let embeddedCount = 0;

  for (const document of documents) {
    try {
      const result = await indexBrainDocument(brainStore, document.id, embeddingProvider, {
        force: true,
        useMock: options?.useMock,
      });
      indexedCount += 1;
      embeddedCount += result.embeddedCount;
    } catch (error) {
      errors.push({
        documentId: document.id,
        message: error instanceof Error ? error.message : "Unbekannter Fehler",
      });
    }
  }

  return {
    worldSlug,
    documentCount: documents.length,
    indexedCount,
    embeddedCount,
    failedCount: errors.length,
    providerOnline,
    embeddingsEnabled: settings.enabled,
    errors,
  };
}

export async function checkEmbeddingHealth(provider?: EmbeddingProvider) {
  const settings = resolveBrainEmbeddingSettings();
  const embeddingProvider =
    provider ?? (await import("./provider")).createEmbeddingProvider();

  if (!settings.enabled || embeddingProvider.id === "disabled") {
    return {
      ok: false,
      enabled: false,
      provider: embeddingProvider.id,
      model: settings.model,
      baseUrl: settings.baseUrl,
      message: "Embeddings deaktiviert",
      store: settings.store,
    };
  }

  const health = await embeddingProvider.healthCheck();
  return {
    ok: health.ok,
    enabled: true,
    provider: embeddingProvider.id,
    model: settings.model,
    baseUrl: settings.baseUrl,
    message: health.message,
    latencyMs: health.latencyMs,
    store: settings.store,
  };
}
