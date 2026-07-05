import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createPrismaClient,
  getSharedPrismaClient,
  isSharedPrismaClient,
} from "./client";

describe("shared prisma disconnect safety", () => {
  it("lets login-style routes disconnect dedicated clients without touching shared prisma", async () => {
    const shared = getSharedPrismaClient();
    const routeClient = createPrismaClient();

    assert.notEqual(routeClient, shared);
    assert.equal(isSharedPrismaClient(routeClient), false);

    await routeClient.$disconnect();

    assert.equal(isSharedPrismaClient(shared), true);
  });
});
