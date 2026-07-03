-- CreateEnum
CREATE TYPE "PromptTemplateCategory" AS ENUM ('repo_audit', 'ui_fix', 'dnd_generator', 'import', 'refactor', 'other');
-- CreateEnum
CREATE TYPE "MaintenanceInterval" AS ENUM ('once', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly');

-- CreateTable
CREATE TABLE "prompt_templates" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "PromptTemplateCategory" NOT NULL DEFAULT 'other',
    "description" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL,
    "variables" JSONB,
    "tags" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "prompt_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prompt_templates_category_idx" ON "prompt_templates"("category");

-- CreateTable
CREATE TABLE "maintenance_tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT '',
    "interval" "MaintenanceInterval" NOT NULL DEFAULT 'yearly',
    "last_done_at" TIMESTAMP(3),
    "next_due_at" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "maintenance_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "maintenance_tasks_next_due_at_idx" ON "maintenance_tasks"("next_due_at");
