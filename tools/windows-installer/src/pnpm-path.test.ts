import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { isDirectoryInPath } from "./pnpm-path.js";

describe("pnpm-path", () => {
  it("detects directory in PATH", () => {
    const tempDir = path.resolve(os.tmpdir());
    const originalPath = process.env.PATH;
    process.env.PATH = `${tempDir}${path.delimiter}${originalPath ?? ""}`;

    try {
      assert.equal(isDirectoryInPath(tempDir), true);
      assert.equal(isDirectoryInPath("__definitely_not_in_path_xyz__"), false);
    } finally {
      process.env.PATH = originalPath;
    }
  });
});
