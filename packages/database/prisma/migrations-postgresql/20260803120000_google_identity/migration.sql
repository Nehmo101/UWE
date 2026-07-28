-- AlterTable
ALTER TABLE "auth_identities" ADD COLUMN "email" TEXT;

-- AuditAction enum extension: oauth_linked, oauth_unlinked
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'oauth_linked';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'oauth_unlinked';
