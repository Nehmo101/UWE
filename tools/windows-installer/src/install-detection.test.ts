import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { detectExistingInstall } from "./install-detection.js";

describe("install-detection", () => {
  it("reports no install for empty directory", () => {
    const root = path.join(os.tmpdir(), `uwe-detect-${process.pid}`);
    const info = detectExistingInstall(root);
    assert.equal(info.installed, false);
    assert.equal(info.hasDatabase, false);
  });
});
