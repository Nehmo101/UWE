import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveAiChatAccess } from "./ai-gateway-access";

describe("resolveAiChatAccess", () => {
  it("blocks unauthenticated users", async () => {
    const result = await resolveAiChatAccess(null);
    assert.equal(result.allowed, false);
    assert.match(result.message, /anmelden/i);
  });
});
