-- AlterEnum
ALTER TYPE "AdminLinkSourceType" ADD VALUE 'scan_document';
-- AlterEnum
ALTER TYPE "AdminLinkTargetType" ADD VALUE 'scan_document';
-- AlterEnum
ALTER TYPE "EntityTagEntityType" ADD VALUE 'scan_document';

-- CreateEnum
CREATE TYPE "ScanDocumentStatus" AS ENUM ('unanalyzed', 'analyzing', 'waiting_for_rtx', 'proposal_ready', 'uncertain', 'filed', 'rejected', 'archived');
-- CreateEnum
CREATE TYPE "ScanDocumentKind" AS ENUM ('letter', 'invoice', 'contract_doc', 'warranty', 'receipt', 'handwritten_note', 'recipe', 'dnd_session_note', 'dnd_dungeon_note', 'dnd_handout', 'unknown');
-- CreateEnum
CREATE TYPE "ScanPrivacyLevel" AS ENUM ('private', 'dnd');

-- CreateTable
CREATE TABLE "scan_documents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "status" "ScanDocumentStatus" NOT NULL DEFAULT 'unanalyzed',
    "privacyLevel" "ScanPrivacyLevel" NOT NULL DEFAULT 'private',
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL DEFAULT 0,
    "page_count" INTEGER,
    "ocr_text" TEXT NOT NULL DEFAULT '',
    "ocr_engine" TEXT,
    "detected_kind" "ScanDocumentKind" NOT NULL DEFAULT 'unknown',
    "detection_confidence" TEXT,
    "extracted_fields" JSONB,
    "proposal" JSONB,
    "uncertainties" JSONB,
    "connector_job_id" TEXT,
    "error_message" TEXT,
    "world_id" TEXT,
    "filed_target_type" TEXT,
    "filed_target_id" TEXT,
    "filed_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "scan_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scan_documents_status_created_at_idx" ON "scan_documents"("status", "created_at");
CREATE INDEX "scan_documents_detected_kind_idx" ON "scan_documents"("detected_kind");
CREATE INDEX "scan_documents_world_id_idx" ON "scan_documents"("world_id");

-- AddForeignKey
ALTER TABLE "scan_documents" ADD CONSTRAINT "scan_documents_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE SET NULL ON UPDATE CASCADE;
