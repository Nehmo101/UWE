import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  canWriteDirectory,
  defaultInstallRoot,
  resolveInstallPaths,
  toFileUrl,
  toPosixPath,
} from "./paths.js";

describe("paths", () => {
  it("resolves the default install layout", () => {
    const root = path.join(os.tmpdir(), "uwe-installer-test");
    const paths = resolveInstallPaths(root);

    assert.equal(paths.root, path.resolve(root));
    assert.equal(paths.app, path.join(path.resolve(root), "app"));
    assert.equal(paths.data, path.join(path.resolve(root), "data"));
    assert.equal(paths.envFile, path.join(path.resolve(root), ".env"));
  });

  it("builds sqlite file URLs for Windows-style paths", () => {
    const url = toFileUrl("C:\\UWE\\data\\uwe.db");
    assert.match(url, /^file:/);
    assert.match(url, /UWE\/data\/uwe\.db/);
  });

  it("normalizes paths to posix", () => {
    assert.equal(toPosixPath("C:\\UWE\\logs"), "C:/UWE/logs");
  });

  it("uses a home-based default outside Windows LOCALAPPDATA", () => {
    const root = defaultInstallRoot();
    assert.ok(root.length > 0);
  });

  it("detects write access in temp directory", () => {
    const probeDir = path.join(os.tmpdir(), `uwe-write-${process.pid}`);
    assert.equal(canWriteDirectory(probeDir), true);
  });
});
