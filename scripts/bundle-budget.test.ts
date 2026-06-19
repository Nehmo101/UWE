/**
 * Bundle budget regression test — inventory guard + budget constants.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "..");

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

describe("bundle budget tooling", () => {
  it("includes bundle budget check script", () => {
    assert.ok(exists("scripts/bundle-budget-check.mjs"));
    const source = fs.readFileSync(path.join(root, "scripts/bundle-budget-check.mjs"), "utf8");
    assert.match(source, /BUNDLE_BUDGETS_KB/);
    assert.match(source, /totalStaticChunksKb/);
  });

  it("wires bundle check into quality pipeline", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    assert.match(pkg.scripts.quality, /bundle-budget-check/);
  });
});
