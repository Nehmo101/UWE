import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createPrismaClient, type PrismaClient } from "./client";
import {
  assertOwnerSetupHasNoSecrets,
  getOwnerSetupSnapshot,
} from "./owner-setup-service";
import { createTestDatabaseUrl } from "./test-helpers";

describe("owner setup service", () => {
  let db: PrismaClient;

  before(async () => {
    db = createPrismaClient(createTestDatabaseUrl());
  });

  it("builds owner setup snapshot without leaking secrets", async () => {
    const env = {
      ...process.env,
      AUTH_SECRET: "test-auth-secret-do-not-leak-12345",
      STUDIO_API_TOKEN: "test-studio-token-do-not-leak",
      SMTP_PASSWORD: "test-smtp-secret-do-not-leak",
    };

    const snapshot = await getOwnerSetupSnapshot(db, {
      env,
      role: "owner",
      canEdit: true,
    });

    assertOwnerSetupHasNoSecrets(snapshot, env);
    assert.equal(snapshot.canEdit, true);
    assert.equal(snapshot.role, "owner");
    assert.equal(snapshot.sections.length, 7);
    assert.ok(snapshot.sections.some((section) => section.id === "mail"));
    assert.ok(snapshot.sections.some((section) => section.id === "cloudflare"));

    const serialized = JSON.stringify(snapshot);
    assert.ok(!serialized.includes("test-smtp-secret-do-not-leak"));
    assert.ok(!serialized.includes("test-auth-secret-do-not-leak-12345"));
    assert.ok(!serialized.includes("test-studio-token-do-not-leak"));
  });

  it("marks host secrets without exposing values", async () => {
    const env = {
      ...process.env,
      AUTH_SECRET: "",
      STUDIO_API_TOKEN: "",
      PUBLIC_APP_URL: "https://uwe.example.org",
      CLOUDFLARE_TUNNEL: "true",
    };

    const snapshot = await getOwnerSetupSnapshot(db, { env, role: "admin", canEdit: false });
    const cloudflare = snapshot.sections.find((section) => section.id === "cloudflare");
    assert.ok(cloudflare);
    const studioToken = cloudflare.settings.find((item) => item.id === "studio-api-token");
    assert.ok(studioToken);
    assert.equal(studioToken.hostSecretRequired, true);
    assert.equal(studioToken.displayValue, "fehlt");
    assert.equal(snapshot.canEdit, false);
  });
});
