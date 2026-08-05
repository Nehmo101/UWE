-- CreateTable
CREATE TABLE "family_caldav_accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "token_prefix" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_used_at" DATETIME,
    "revoked_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "family_caldav_accounts_token_hash_key" ON "family_caldav_accounts"("token_hash");

-- CreateIndex
CREATE INDEX "family_caldav_accounts_is_active_idx" ON "family_caldav_accounts"("is_active");
