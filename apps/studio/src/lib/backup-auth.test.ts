import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveBackupActorRole } from "./backup-auth";

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://studio.local/api/backup", {
    method: "POST",
    headers,
  });
}

describe("backup API authorization", () => {
  it("maps ADMIN header alias to dm role", async () => {
    const role = await resolveBackupActorRole(
      makeRequest({ "x-uwe-actor-role": "ADMIN" }),
    );
    assert.equal(role, "dm");
  });

  it("defaults to owner when no actor header is set", async () => {
    const role = await resolveBackupActorRole(makeRequest());
    assert.equal(role, "owner");
  });

  it("respects explicit PLAYER role header", async () => {
    const role = await resolveBackupActorRole(
      makeRequest({ "x-uwe-actor-role": "PLAYER" }),
    );
    assert.equal(role, "player");
  });
});
