import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createPrismaClient, type PrismaClient } from "./client";
import {
  buildFirstRunPrerequisites,
  buildFirstRunProductionHints,
  getFirstRunSetupStatus,
} from "./first-run-setup-service";
import { createTestDatabaseUrl } from "./test-helpers";

describe("first-run setup service", () => {
  let db: PrismaClient;

  before(async () => {
    db = createPrismaClient(createTestDatabaseUrl());
  });

  it("blocks when setup token or migrations are missing", () => {
    const result = buildFirstRunPrerequisites(
      {},
      "Migrations-Tabelle nicht lesbar.",
      false,
      false,
    );

    assert.equal(result.canProceed, false);
    assert.equal(result.items.find((item) => item.id === "setup-token")?.status, "error");
    assert.equal(result.items.find((item) => item.id === "migrations")?.status, "error");
  });

  it("warns on weak auth secret but allows proceed when token and migrations are ok", () => {
    const result = buildFirstRunPrerequisites(
      {
        UWE_SETUP_TOKEN: "a-secure-setup-token-value",
        AUTH_SECRET: "change-me",
      },
      "3 Migration(en) angewendet.",
      true,
      false,
    );

    assert.equal(result.canProceed, true);
    assert.equal(result.ok, false);
    assert.equal(result.items.find((item) => item.id === "auth-secret")?.status, "warning");
  });

  it("builds production hints without leaking secret values", () => {
    const hints = buildFirstRunProductionHints({
      RUN_DB_SEED: "true",
      AUTH_REQUIRED: "false",
      AUTH_SECRET: "super-secret-do-not-leak",
    });

    assert.ok(hints.items.length >= 3);
    const serialized = JSON.stringify(hints);
    assert.ok(!serialized.includes("super-secret-do-not-leak"));
    assert.equal(hints.items.find((item) => item.id === "run-db-seed")?.status, "warning");
    assert.equal(hints.items.find((item) => item.id === "auth-required")?.status, "warning");
  });

  it("loads live status from a migrated database", async () => {
    const status = await getFirstRunSetupStatus(db, {
      env: {
        UWE_SETUP_TOKEN: "test-setup-token",
        AUTH_SECRET: "a-strong-random-secret-value-here",
        RUN_DB_SEED: "false",
        AUTH_REQUIRED: "true",
      },
    });

    assert.equal(status.prerequisites.canProceed, true);
    assert.equal(status.prerequisites.items.find((item) => item.id === "migrations")?.status, "ok");
    assert.ok(status.productionHints.items.length >= 3);
  });
});
