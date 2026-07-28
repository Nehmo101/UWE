import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPrismaClient } from "./client";
import { createTestBrainClient, createTestDatabaseUrl } from "./test-helpers";
import { encryptSecret } from "./token-crypto";
import {
  assertSecretsStatusHasNoSecrets,
  collectRotationDueSecretIds,
  getSecretsStatusSnapshot,
  type SecretsStatusSection,
} from "./secrets-status-service";

describe("secrets status service", () => {
  it("builds snapshot without leaking env secrets", async () => {
    const db = createPrismaClient(createTestDatabaseUrl());
    const brainDb = createTestBrainClient();
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
      const snapshot = await getSecretsStatusSnapshot(db, brainDb, { env });

      assertSecretsStatusHasNoSecrets(snapshot, env);
      assert.equal(snapshot.encryptionKeyConfigured, true);
      assert.ok(snapshot.sections.some((section) => section.id === "bootstrap"));
      assert.ok(snapshot.sections.some((section) => section.id === "host-env"));

      const bootstrap = snapshot.sections.find((section) => section.id === "bootstrap");
      assert.ok(bootstrap);
      const authItem = bootstrap.items.find((item) => item.id === "auth-secret");
      assert.ok(authItem);
      assert.equal(authItem.bootstrap, true);
      assert.equal(authItem.maskedHint, "nur ENV");
      assert.equal(authItem.status, "set");

      // Ein übrig gebliebener Cloud-Schlüssel wird als Altlast gemeldet — mit
      // Namen, aber ohne Wert und ohne Last-4: der Wert soll niemanden mehr
      // interessieren, der Schlüssel gehört gelöscht.
      const stale = snapshot.sections
        .find((section) => section.id === "host-env")
        ?.items.find((item) => item.id === "stale-cloud-key:openai-api-key");
      assert.ok(stale);
      assert.equal(stale?.maskedHint, null);
      assert.match(stale?.description ?? "", /RTX-Host/);
      assert.ok(!JSON.stringify(snapshot).includes(secret));
      assert.ok(!JSON.stringify(snapshot).includes("sk-openai-test-key-abcdefghij"));
    } finally {
      await db.$disconnect();
    }
  });

  it("flags decrypt failures after encryption key mismatch", async () => {
    const db = createPrismaClient(createTestDatabaseUrl());
    const brainDb = createTestBrainClient();
    const originalKey = "original-encryption-key-32chars!!";
    const rotatedKey = "rotated-encryption-key-32chars!!";

    try {
      // Ein DB-verschlüsseltes Secret genügt. Der Inference-Endpunkt eignet
      // sich, weil die Momentaufnahme ihn erst beim Zusammenbauen entschlüsselt
      // — ein Feld, das schon beim Laden der Einstellungen entschlüsselt wird,
      // würde vorher werfen und nie im Bericht landen.
      const encrypted = encryptSecret("inference-key-value-xyz9", originalKey);
      const endpoint = await db.inferenceEndpoint.create({
        data: { name: "Test-Endpunkt", baseUrl: "http://localhost:11434", apiKeyEnc: encrypted },
      });

      const snapshot = await getSecretsStatusSnapshot(db, brainDb, {
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
        .find((item) => item.id === `inference-endpoint:${endpoint.id}`);
      assert.ok(dbItem);
      assert.equal(dbItem.status, "decrypt_failed");
    } finally {
      await db.$disconnect();
    }
  });

  it("flags DB secrets older than rotation reminder threshold", () => {
    const staleUpdatedAt = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString();
    const sections: SecretsStatusSection[] = [
      {
        id: "db-encrypted",
        title: "Test",
        description: "Test",
        items: [
          {
            id: "inference-endpoint:stale",
            label: "Stale endpoint",
            source: "db-encrypted",
            status: "set",
            maskedHint: "••••••1234",
            bootstrap: false,
            updatedAt: staleUpdatedAt,
          },
          {
            id: "inference-endpoint:fresh",
            label: "Fresh endpoint",
            source: "db-encrypted",
            status: "set",
            maskedHint: "••••••5678",
            bootstrap: false,
            updatedAt: new Date().toISOString(),
          },
        ],
      },
    ];

    const rotationDueSecretIds = collectRotationDueSecretIds(sections, 90);
    assert.deepEqual(rotationDueSecretIds, ["inference-endpoint:stale"]);
  });
});
