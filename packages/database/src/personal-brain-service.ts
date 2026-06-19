import type { PrismaClient } from "./client";

export interface PersonalBrainChunkRecord {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number | null;
  embedding: number[] | null;
  document: {
    id: string;
    title: string;
    category: string | null;
  };
}

export interface CreatePersonalBrainChunkInput {
  chunkIndex: number;
  content: string;
  tokenCount?: number | null;
  embedding?: number[] | null;
}

export interface PersonalBrainIndexStatus {
  documentId: string;
  title: string;
  chunkCount: number;
  embeddedCount: number;
}

function parseEmbeddingVector(value: unknown): number[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const vector = value.filter((entry): entry is number => typeof entry === "number");
  return vector.length > 0 ? vector : null;
}

export class PersonalBrainService {
  constructor(private readonly db: PrismaClient) {}

  async getDocumentById(id: string) {
    return this.db.personalBrainDocument.findUnique({
      where: { id },
      include: { chunks: { orderBy: { chunkIndex: "asc" } } },
    });
  }

  async listDocuments(options: { category?: string; limit?: number } = {}) {
    return this.db.personalBrainDocument.findMany({
      where: { category: options.category },
      orderBy: { updatedAt: "desc" },
      take: options.limit ?? 100,
      include: {
        chunks: {
          select: { id: true, embedding: true },
        },
      },
    });
  }

  async listFacts(options: { factType?: string; limit?: number } = {}) {
    return this.db.personalBrainFact.findMany({
      where: { factType: options.factType },
      orderBy: { updatedAt: "desc" },
      take: options.limit ?? 100,
    });
  }

  async listSearchableChunks(documentIds?: string[]): Promise<PersonalBrainChunkRecord[]> {
    const chunks = await this.db.personalBrainChunk.findMany({
      where: documentIds?.length ? { documentId: { in: documentIds } } : undefined,
      include: {
        document: {
          select: {
            id: true,
            title: true,
            category: true,
          },
        },
      },
      orderBy: [{ documentId: "asc" }, { chunkIndex: "asc" }],
    });

    return chunks.map((chunk) => ({
      id: chunk.id,
      documentId: chunk.documentId,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      tokenCount: chunk.tokenCount,
      embedding: parseEmbeddingVector(chunk.embedding),
      document: chunk.document,
    }));
  }

  async replaceDocumentChunks(
    documentId: string,
    chunks: CreatePersonalBrainChunkInput[],
  ): Promise<void> {
    const document = await this.db.personalBrainDocument.findUnique({ where: { id: documentId } });
    if (!document) {
      throw new Error("Personal brain document not found");
    }

    await this.db.$transaction([
      this.db.personalBrainChunk.deleteMany({ where: { documentId } }),
      ...chunks.map((chunk) =>
        this.db.personalBrainChunk.create({
          data: {
            documentId,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            tokenCount: chunk.tokenCount ?? null,
            embedding: chunk.embedding ?? undefined,
          },
        }),
      ),
    ]);
  }

  async getIndexStatusForDocuments(): Promise<PersonalBrainIndexStatus[]> {
    const documents = await this.db.personalBrainDocument.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        chunks: {
          select: { embedding: true },
        },
      },
    });

    return documents.map((document) => ({
      documentId: document.id,
      title: document.title,
      chunkCount: document.chunks.length,
      embeddedCount: document.chunks.filter((chunk) => parseEmbeddingVector(chunk.embedding)).length,
    }));
  }
}

export function createPersonalBrainService(db: PrismaClient): PersonalBrainService {
  return new PersonalBrainService(db);
}
