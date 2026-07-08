-- CreateTable: per-project step checklist
CREATE TABLE "project_steps" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "project_steps_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "personal_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: uploaded project media (Mediathek)
CREATE TABLE "project_images" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL DEFAULT '',
    "mime_type" TEXT NOT NULL DEFAULT 'application/octet-stream',
    "caption" TEXT NOT NULL DEFAULT '',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_images_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "personal_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "project_steps_project_id_sort_order_idx" ON "project_steps"("project_id", "sort_order");

-- CreateIndex
CREATE INDEX "project_images_project_id_sort_order_idx" ON "project_images"("project_id", "sort_order");
