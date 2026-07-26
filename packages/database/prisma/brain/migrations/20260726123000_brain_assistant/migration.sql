-- Brain-Assistent: hinterlegte Connector-KI, persistente Unterhaltungen,
-- Nachrichten und Anhänge (Bild / Dokument / Audio).
--
-- Hinweis: `prisma migrate diff` schlägt zusätzlich vor, die `mail_messages_fts*`-
-- Tabellen zu löschen. Das ist Alt-Drift — die FTS5-Virtualtabelle wird per
-- Raw-SQL angelegt und ist im Prisma-Datenmodell nicht abbildbar. Bewusst
-- ausgelassen, damit die Mail-Volltextsuche erhalten bleibt.


-- CreateTable
CREATE TABLE "brain_assistant_profile" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "chat_connector_id" TEXT,
    "chat_model_id" TEXT,
    "chat_model_label" TEXT,
    "vision_connector_id" TEXT,
    "vision_model_id" TEXT,
    "vision_model_label" TEXT,
    "stt_model_name" TEXT,
    "system_prompt" TEXT NOT NULL DEFAULT '',
    "default_context_mode" TEXT NOT NULL DEFAULT 'plain',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "brain_chat_conversations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "context_mode" TEXT NOT NULL DEFAULT 'plain',
    "connector_id" TEXT,
    "model_id" TEXT,
    "model_label" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "brain_chat_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversation_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "model" TEXT,
    "route" TEXT,
    "duration_ms" INTEGER,
    "error_message" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "brain_chat_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "brain_chat_conversations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "brain_chat_attachments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversation_id" TEXT NOT NULL,
    "message_id" TEXT,
    "kind" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "extracted_text" TEXT,
    "analysis_job_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "brain_chat_attachments_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "brain_chat_conversations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "brain_chat_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "brain_chat_messages" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "brain_chat_conversations_updated_at_idx" ON "brain_chat_conversations"("updated_at");

-- CreateIndex
CREATE INDEX "brain_chat_messages_conversation_id_created_at_idx" ON "brain_chat_messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "brain_chat_attachments_conversation_id_created_at_idx" ON "brain_chat_attachments"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "brain_chat_attachments_message_id_idx" ON "brain_chat_attachments"("message_id");

