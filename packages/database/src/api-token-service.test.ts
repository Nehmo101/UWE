import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createPrismaClient } from "./client";
import { createApiTokenService } from "./api-token-service";
import { createTestDatabaseUrl } from "./test-helpers";
import { hashApiToken } from "@uwe/auth/server";

describe("api-token-service", () => {
  let databaseUrl = "";
  let userId = "";

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    const db = createPrismaClient(databaseUrl);
    const user = await db.user.create({
      data: {
        displayName: "Token Test Admin",
        role: "admin",
      },
    });
    userId = user.id;
    await db.$disconnect();
  });

  after(async () => {
    const db = createPrismaClient(databaseUrl);
    await db.apiTokenUsageLog.deleteMany();
    await db.apiTokenScope.deleteMany();
    await db.apiToken.deleteMany();
    await db.user.deleteMany({ where: { id: userId } });
    await db.$disconnect();
  });

  it("stores only hashed tokens", async () => {
    const db = createPrismaClient(databaseUrl);
    const service = createApiTokenService(db);
    const created = await service.create({
      userId,
      userRole: "admin",
      name: "CI Token",
      scopes: ["health_read"],
    });

    const stored = await db.apiToken.findUnique({ where: { id: created.token.id } });
    assert.ok(stored);
    assert.notEqual(stored.tokenHash, created.plaintextToken);
    assert.equal(stored.tokenHash, hashApiToken(created.plaintextToken));
    assert.ok(!stored.tokenHash.includes("uwe_"));
    await db.$disconnect();
  });

  it("resolves bearer tokens with scopes", async () => {
    const db = createPrismaClient(databaseUrl);
    const service = createApiTokenService(db);
    const created = await service.create({
      userId,
      userRole: "admin",
      name: "Bearer Token",
      scopes: ["admin_read", "health_read"],
    });

    const resolved = await service.resolveFromBearer(created.plaintextToken);
    assert.ok(resolved);
    assert.equal(resolved.userId, userId);
    assert.ok(resolved.scopes.includes("admin_read"));
    await db.$disconnect();
  });

  it("revokes tokens", async () => {
    const db = createPrismaClient(databaseUrl);
    const service = createApiTokenService(db);
    const created = await service.create({
      userId,
      userRole: "admin",
      name: "Revoke Me",
      scopes: ["health_read"],
    });

    await service.revoke(created.token.id, userId);
    const resolved = await service.resolveFromBearer(created.plaintextToken);
    assert.equal(resolved, null);
    await db.$disconnect();
  });
});
