-- Session tokens are now stored as SHA-256 hashes (see hashOpaqueToken in @uwe/auth).
-- Existing plaintext tokens cannot be migrated without the original cookie values.
DELETE FROM "sessions";
