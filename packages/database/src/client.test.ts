import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createPrismaClient,
  getSharedPrismaClient,
  isSharedPrismaClient,
} from "./client";

describe("createPrismaClient", () => {
  it("reuses the shared SQLite client for the default database URL", () => {
    const shared = getSharedPrismaClient();
    const created = createPrismaClient();

    assert.equal(created, shared);
    assert.equal(isSharedPrismaClient(created), true);
  });

  it("creates a dedicated client when a custom database URL is provided", () => {
    const shared = getSharedPrismaClient();
    const dedicated = createPrismaClient("file:./data/uwe-test-isolated.db");

    assert.notEqual(dedicated, shared);
    assert.equal(isSharedPrismaClient(dedicated), false);
  });
});
