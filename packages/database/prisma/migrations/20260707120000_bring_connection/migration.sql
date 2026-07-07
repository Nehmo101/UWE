-- CreateTable
CREATE TABLE "bring_connections" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "email_encrypted" TEXT NOT NULL,
    "password_encrypted" TEXT NOT NULL,
    "bring_user_uuid" TEXT,
    "bring_public_uuid" TEXT,
    "default_list_uuid" TEXT,
    "default_list_name" TEXT,
    "available_lists" JSONB,
    "last_synced_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
