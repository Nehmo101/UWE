import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createPrismaClient } from "./client";
import {
  getProductionSafetyWarnings,
  isPublicPortalExposureEnabled,
  isRunDbSeedUnsafe,
  isWeakAuthSecret,
} from "./production-safety";
import { createSettingsService } from "./settings-service";
import { createTestDatabaseUrl } from "./test-helpers";

describe("production safety helpers", () => {
  let databaseUrl: string;

  before(() => {
    databaseUrl = createTestDatabaseUrl();
  });

  after(async () => {
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("detects weak auth secrets", () => {
    assert.equal(isWeakAuthSecret(undefined), true);
    assert.equal(isWeakAuthSecret("change-me"), true);
    assert.equal(isWeakAuthSecret("generate-a-random-secret-for-production"), true);
    assert.equal(isWeakAuthSecret("x".repeat(32)), false);
  });

  it("flags unsafe RUN_DB_SEED values", () => {
    const previous = process.env.RUN_DB_SEED;
    try {
      process.env.RUN_DB_SEED = "false";
      assert.equal(isRunDbSeedUnsafe(), false);

      process.env.RUN_DB_SEED = "auto";
      assert.equal(isRunDbSeedUnsafe(), true);
    } finally {
      if (previous === undefined) {
        delete process.env.RUN_DB_SEED;
      } else {
        process.env.RUN_DB_SEED = previous;
      }
    }
  });

  it("detects public portal exposure from settings", async () => {
    const service = createSettingsService(createPrismaClient(databaseUrl));

    await service.updateSettings({
      portal: { guestAccessEnabled: false, publicSharingEnabled: false },
    });
    assert.equal(isPublicPortalExposureEnabled(await service.getSettings()), false);

    await service.updateSettings({
      portal: { publicSharingEnabled: true },
    });
    assert.equal(isPublicPortalExposureEnabled(await service.getSettings()), true);
  });

  it("builds production warnings without leaking secret values", async () => {
    const previousAuth = process.env.AUTH_SECRET;
    const previousSeed = process.env.RUN_DB_SEED;
    const previousToken = process.env.STUDIO_API_TOKEN;

    process.env.AUTH_SECRET = "change-me";
    delete process.env.STUDIO_API_TOKEN;
    process.env.RUN_DB_SEED = "auto";

    try {
      const warnings = await getProductionSafetyWarnings(createPrismaClient(databaseUrl));
      const serialized = JSON.stringify(warnings);

      assert.ok(warnings.some((warning) => warning.id === "production:auth-secret"));
      assert.ok(warnings.some((warning) => warning.id === "production:run-db-seed"));
      assert.ok(warnings.some((warning) => warning.id === "production:studio-api-token"));
      assert.ok(warnings.some((warning) => warning.id === "production:studio-exposure"));
      assert.ok(!serialized.includes("change-me"));
    } finally {
      if (previousAuth === undefined) {
        delete process.env.AUTH_SECRET;
      } else {
        process.env.AUTH_SECRET = previousAuth;
      }
      if (previousSeed === undefined) {
        delete process.env.RUN_DB_SEED;
      } else {
        process.env.RUN_DB_SEED = previousSeed;
      }
      if (previousToken === undefined) {
        delete process.env.STUDIO_API_TOKEN;
      } else {
        process.env.STUDIO_API_TOKEN = previousToken;
      }
    }
  });
});
