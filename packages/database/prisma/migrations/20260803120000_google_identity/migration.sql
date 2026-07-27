-- AlterTable
ALTER TABLE "auth_identities" ADD COLUMN "email" TEXT;

-- AuditAction enum extension: oauth_linked, oauth_unlinked (SQLite stores action as TEXT; no DDL required).
