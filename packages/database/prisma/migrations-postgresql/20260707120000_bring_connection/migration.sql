-- CreateTable
CREATE TABLE "bring_connections" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "email_encrypted" TEXT NOT NULL,
    "password_encrypted" TEXT NOT NULL,
    "bring_user_uuid" TEXT,
    "bring_public_uuid" TEXT,
    "default_list_uuid" TEXT,
    "default_list_name" TEXT,
    "available_lists" JSONB,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bring_connections_pkey" PRIMARY KEY ("id")
);
