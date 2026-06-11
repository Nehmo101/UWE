-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "settings" JSONB NOT NULL,
    "updated_at" DATETIME NOT NULL
);
