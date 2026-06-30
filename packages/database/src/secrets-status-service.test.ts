import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPrismaClient } from "./client";
import { createTestDatabaseUrl } from "./test-helpers";
import { encryptSecret } from "./token-crypto";
import {
  assertSecretsStatusHasNoSecrets,
  getSecretsStatusSnapshot,
} from "./secrets-status-service";

describe("secrets status service", () => {
  it("builds snapshot without leaking env secrets", async () => {
    const db = createPrismaClient(createTestDatabaseUrl());
    const secret = "test-auth-secret-do-not-leak-12345";
    const env = {
      NODE_ENV: "development",
      AUTH_SECRET: secret,
      STUDIO_API_TOKEN: "test-studio-token-do-not-leak",
      SMTP_PASSWORD: "test-smtp-secret-do-not-leak",
      OPENAI_API_KEY: "sk-openai-test-key-abcdefghij",
      DATABASE_URL: "file:./data/test.db",
    };

    try {
      const snapshot = await getSecretsStatusSnapshot(db, { env });

      assertSecretsStatusHasNoSecrets(snapshot, env);
      assert.equal(snapshot.encryptionKeyConfigured, true);
      assert.ok(snapshot.sections.some((section) => section.id === "bootstrap"));
      assert.ok(snapshot.sections.some((section) => section.id === "host-env"));

      const bootstrap = snapshot.sections.find((section) => section.id === "bootstrap");
      assert.ok(bootstrap);
      const authItem = bootstrap.items.find((item) => item.id === "auth-secret");
      assert.ok(authItem);
      assert.equal(authItem.bootstrap, true);
      assert.equal(authItem.maskedHint, null);
      assert.equal(authItem.status, "set");

      const openAi = snapshot.sections
        .find((section) => section.id === "host-env")
        ?.items.find((item) => item.id === "openai-api-key");
      assert.ok(openAi);
      assert.equal(openAi?.maskedHint, "••••••ghij");
      assert.ok(!JSON.stringify(snapshot).includes(secret));
      assert.ok(!JSON.stringify(snapshot).includes("sk-openai-test-key-abcdefghij"));
    } finally {
      await db.$disconnect();
    }
  });

  it("flags decrypt failures after encryption key mismatch", async () => {
    const db = createPrismaClient(createTestDatabaseUrl());
    const originalKey = "original-encryption-key-32chars!!";
    const rotatedKey = "rotated-encryption-key-32chars!!";

    try {
      const encrypted = encryptSecret("provider-key-value-xyz9", originalKey);
      await db.systemSettings.upsert({
        where: { id: "default" },
        create: {
          id: "default",
          settings: {
            ai: {
              cloudApiKeys: [{ providerId: "openai", keyEnc: encrypted }],
            },
          },
        },
        update: {
          settings: {
            ai: {
              cloudApiKeys: [{ providerId: "openai", keyEnc: encrypted }],
            },
          },
        },
      });

      const snapshot = await getSecretsStatusSnapshot(db, {
        env: {
          NODE_ENV: "development",
          AUTH_SECRET: rotatedKey,
          DATABASE_URL: "file:./data/test.db",
        },
      });

      assert.ok(snapshot.affectedByAuthSecretRotation.length > 0);
      assert.ok(
        snapshot.warnings.some((warning) => warning.id === "secrets:auth-secret-rotation"),
      );
      const dbItem = snapshot.sections
        .flatMap((section) => section.items)
        .find((item) => item.id === "ai-provider-key:openai");
      assert.ok(dbItem);
      assert.equal(dbItem.status, "decrypt_failed");
    } finally {
      await db.$disconnect();
    }
  });
});
