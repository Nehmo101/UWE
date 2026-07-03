-- CreateTable
CREATE TABLE "prompt_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'other',
    "description" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL,
    "variables" JSONB,
    "tags" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "prompt_templates_category_idx" ON "prompt_templates"("category");

-- CreateTable
CREATE TABLE "maintenance_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT '',
    "interval" TEXT NOT NULL DEFAULT 'yearly',
    "last_done_at" DATETIME,
    "next_due_at" DATETIME,
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "maintenance_tasks_next_due_at_idx" ON "maintenance_tasks"("next_due_at");
