-- Session tokens are stored as SHA-256 hashes in token_hash (see hashOpaqueToken in @uwe/auth).
DELETE FROM "sessions";
ALTER TABLE "sessions" RENAME COLUMN "token" TO "token_hash";
