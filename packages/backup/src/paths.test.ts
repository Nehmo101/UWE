import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveSchemaVersion } from "./paths";

describe("backup paths", () => {
  it("resolveSchemaVersion returns a migration name or unknown without throwing", () => {
    const version = resolveSchemaVersion();
    assert.ok(typeof version === "string");
    assert.ok(version.length > 0);
  });
});
