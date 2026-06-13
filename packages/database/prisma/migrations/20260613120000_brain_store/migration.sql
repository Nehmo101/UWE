-- Brain Knowledge Store: documents, chunks, facts and links (stored in UWE on the host laptop)

CREATE TABLE "brain_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "game_session_id" TEXT,
    "page_id" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "document_type" TEXT NOT NULL DEFAULT 'general',
    "visibility" TEXT NOT NULL DEFAULT 'dm_only',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "trust_level" REAL,
    "metadata" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "brain_documents_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "brain_documents_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "brain_documents_game_session_id_fkey" FOREIGN KEY ("game_session_id") REFERENCES "game_sessions" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "brain_documents_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "brain_documents_world_id_status_idx" ON "brain_documents"("world_id", "status");
CREATE INDEX "brain_documents_world_id_visibility_idx" ON "brain_documents"("world_id", "visibility");
CREATE INDEX "brain_documents_world_id_document_type_idx" ON "brain_documents"("world_id", "document_type");
CREATE INDEX "brain_documents_page_id_idx" ON "brain_documents"("page_id");
CREATE INDEX "brain_documents_game_session_id_idx" ON "brain_documents"("game_session_id");

CREATE TABLE "brain_chunks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "document_id" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "token_count" INTEGER,
    "embedding" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "brain_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "brain_documents" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "brain_chunks_document_id_chunk_index_key" ON "brain_chunks"("document_id", "chunk_index");
CREATE INDEX "brain_chunks_document_id_idx" ON "brain_chunks"("document_id");

CREATE TABLE "brain_facts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "game_session_id" TEXT,
    "page_id" TEXT,
    "fact_type" TEXT NOT NULL DEFAULT 'custom',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "visibility" TEXT NOT NULL DEFAULT 'dm_only',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "confidence" REAL,
    "metadata" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "brain_facts_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "brain_facts_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "brain_facts_game_session_id_fkey" FOREIGN KEY ("game_session_id") REFERENCES "game_sessions" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "brain_facts_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "brain_facts_world_id_status_idx" ON "brain_facts"("world_id", "status");
CREATE INDEX "brain_facts_world_id_visibility_idx" ON "brain_facts"("world_id", "visibility");
CREATE INDEX "brain_facts_world_id_fact_type_idx" ON "brain_facts"("world_id", "fact_type");
CREATE INDEX "brain_facts_page_id_idx" ON "brain_facts"("page_id");
CREATE INDEX "brain_facts_game_session_id_idx" ON "brain_facts"("game_session_id");

CREATE TABLE "brain_links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "relation_type" TEXT NOT NULL DEFAULT 'related',
    "label" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "brain_links_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "brain_links_world_id_idx" ON "brain_links"("world_id");
CREATE INDEX "brain_links_source_type_source_id_idx" ON "brain_links"("source_type", "source_id");
CREATE INDEX "brain_links_target_type_target_id_idx" ON "brain_links"("target_type", "target_id");
