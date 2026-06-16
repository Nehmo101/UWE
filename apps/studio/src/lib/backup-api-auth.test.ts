import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextResponse } from "next/server";
import { requireBackupAuth } from "./backup-auth";

function makeRequest(role?: string): Request {
  const headers: Record<string, string> = { host: "studio.local" };
  if (role) {
    headers["x-uwe-actor-role"] = role;
  }
  return new Request("http://studio.local/api/backup", { method: "POST", headers });
}

describe("backup API authorization", () => {
  it("denies PLAYER from creating backups", async () => {
    const result = await requireBackupAuth(makeRequest("PLAYER"), "create");
    assert.ok(result instanceof NextResponse);
    assert.equal(result.status, 403);
  });

  it("allows ADMIN to create backups", async () => {
    const result = await requireBackupAuth(makeRequest("ADMIN"), "create");
    assert.ok(!(result instanceof NextResponse));
    assert.equal(result.role, "dm");
  });

  it("allows OWNER to create backups", async () => {
    const result = await requireBackupAuth(makeRequest("OWNER"), "create");
    assert.ok(!(result instanceof NextResponse));
    assert.equal(result.role, "owner");
  });

  it("denies ADMIN from restore", async () => {
    const result = await requireBackupAuth(makeRequest("ADMIN"), "restore");
    assert.ok(result instanceof NextResponse);
    assert.equal(result.status, 403);
  });

  it("allows only OWNER to restore", async () => {
    const owner = await requireBackupAuth(makeRequest("OWNER"), "restore");
    assert.ok(!(owner instanceof NextResponse));

    const player = await requireBackupAuth(makeRequest("PLAYER"), "restore");
    assert.ok(player instanceof NextResponse);
    assert.equal(player.status, 403);
  });
});
