-- CreateTable
CREATE TABLE "personal_brain_chunks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "document_id" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "token_count" INTEGER,
    "embedding" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "personal_brain_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "personal_brain_documents" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "personal_brain_chunks_document_id_idx" ON "personal_brain_chunks"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "personal_brain_chunks_document_id_chunk_index_key" ON "personal_brain_chunks"("document_id", "chunk_index");
