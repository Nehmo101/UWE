-- Enum-Erweiterungen (AdminLinkSourceType/TargetType, EntityTagEntityType): SQLite speichert Enums als TEXT.

-- CreateTable
CREATE TABLE "scan_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'unanalyzed',
    "privacyLevel" TEXT NOT NULL DEFAULT 'private',
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL DEFAULT 0,
    "page_count" INTEGER,
    "ocr_text" TEXT NOT NULL DEFAULT '',
    "ocr_engine" TEXT,
    "detected_kind" TEXT NOT NULL DEFAULT 'unknown',
    "detection_confidence" TEXT,
    "extracted_fields" JSONB,
    "proposal" JSONB,
    "uncertainties" JSONB,
    "connector_job_id" TEXT,
    "error_message" TEXT,
    "world_id" TEXT,
    "filed_target_type" TEXT,
    "filed_target_id" TEXT,
    "filed_at" DATETIME,
    "rejected_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "scan_documents_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "scan_documents_status_created_at_idx" ON "scan_documents"("status", "created_at");
CREATE INDEX "scan_documents_detected_kind_idx" ON "scan_documents"("detected_kind");
CREATE INDEX "scan_documents_world_id_idx" ON "scan_documents"("world_id");
