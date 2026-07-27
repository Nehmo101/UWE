-- CreateTable
CREATE TABLE "family_chat_conversations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'shared',
    "owner_user_id" TEXT,
    "connector_id" TEXT,
    "model_id" TEXT,
    "model_label" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "family_chat_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversation_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "model" TEXT,
    "error_message" TEXT,
    "duration_ms" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "family_chat_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "family_chat_conversations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "family_brain_facts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "owner_user_id" TEXT,
    "tags" JSONB,
    "source" TEXT NOT NULL DEFAULT 'chat',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "family_member_profiles" (
    "user_id" TEXT NOT NULL PRIMARY KEY,
    "display_name" TEXT NOT NULL,
    "colour" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "family_chat_conversations_scope_owner_user_id_updated_at_idx" ON "family_chat_conversations"("scope", "owner_user_id", "updated_at");

-- CreateIndex
CREATE INDEX "family_chat_messages_conversation_id_created_at_idx" ON "family_chat_messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "family_brain_facts_owner_user_id_updated_at_idx" ON "family_brain_facts"("owner_user_id", "updated_at");

