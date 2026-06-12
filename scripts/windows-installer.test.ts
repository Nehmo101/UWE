import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "..");

describe("windows installer scaffolding", () => {
  it("includes installer package, scripts, and docs", () => {
    assert.ok(fs.existsSync(path.join(root, "tools/windows-installer/package.json")));
    assert.ok(fs.existsSync(path.join(root, "tools/windows-installer/src/cli.ts")));
    assert.ok(fs.existsSync(path.join(root, "scripts/windows/uwe-launcher.ps1")));
    assert.ok(fs.existsSync(path.join(root, "docs/WINDOWS_INSTALLER.md")));
    assert.ok(fs.existsSync(path.join(root, ".github/workflows/windows-installer.yml")));
  });

  it("documents release and dev modes", () => {
    const doc = fs.readFileSync(path.join(root, "docs/WINDOWS_INSTALLER.md"), "utf8");
    assert.match(doc, /Dev mode/i);
    assert.match(doc, /Release mode/i);
    assert.match(doc, /RUN_DB_SEED=false/);
  });
});
