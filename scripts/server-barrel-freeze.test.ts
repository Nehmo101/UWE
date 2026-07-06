import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const root = path.resolve(import.meta.dirname, "..");
const serverTs = path.join(root, "packages/database/src/server.ts");

/** Frozen ceiling — ratchet down only after extracting exports to subpaths. */
const SERVER_BARREL_MAX_LINES = 2245;

describe("server.ts barrel freeze", () => {
  it("does not grow beyond the frozen line ceiling", () => {
    const content = fs.readFileSync(serverTs, "utf8");
    const lines = content.endsWith("\n")
      ? content.slice(0, -1).split("\n").length
      : content.split("\n").length;
    assert.ok(
      lines <= SERVER_BARREL_MAX_LINES,
      `packages/database/src/server.ts has ${lines} lines (max ${SERVER_BARREL_MAX_LINES}). ` +
        "Add new symbols via package.json subpath exports instead of the barrel.",
    );
  });
});
