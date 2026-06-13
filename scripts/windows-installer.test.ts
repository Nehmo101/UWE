import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "..");

describe("windows installer scaffolding", () => {
  it("includes installer package, scripts, wizard, and docs", () => {
    assert.ok(fs.existsSync(path.join(root, "tools/windows-installer/package.json")));
    assert.ok(fs.existsSync(path.join(root, "tools/windows-installer/src/cli.ts")));
    assert.ok(fs.existsSync(path.join(root, "tools/windows-installer/src/doctor.ts")));
    assert.ok(fs.existsSync(path.join(root, "tools/windows-installer/src/repair.ts")));
    assert.ok(fs.existsSync(path.join(root, "tools/windows-installer/src/pnpm-path.ts")));
    assert.ok(fs.existsSync(path.join(root, "scripts/windows/uwe-wizard.ps1")));
    assert.ok(fs.existsSync(path.join(root, "scripts/windows/uwe-control-panel.ps1")));
    assert.ok(fs.existsSync(path.join(root, "scripts/windows/uwe-launcher.ps1")));
    assert.ok(fs.existsSync(path.join(root, "docs/windows-install.md")));
    assert.ok(fs.existsSync(path.join(root, "docs/windows-troubleshooting.md")));
    assert.ok(fs.existsSync(path.join(root, "docs/backup-restore.md")));
    assert.ok(fs.existsSync(path.join(root, "docs/windows-test-checklist.md")));
    assert.ok(fs.existsSync(path.join(root, ".github/workflows/windows-installer.yml")));
  });

  it("documents release and dev modes", () => {
    const doc = fs.readFileSync(path.join(root, "docs/WINDOWS_INSTALLER.md"), "utf8");
    assert.match(doc, /Dev mode/i);
    assert.match(doc, /Release mode/i);
    assert.match(doc, /RUN_DB_SEED=false/);
  });

  it("exposes root package scripts for windows installer", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    assert.ok(pkg.scripts["installer:windows"]);
    assert.ok(pkg.scripts["launcher:dev"]);
    assert.ok(pkg.scripts["package:windows"]);
    assert.ok(pkg.scripts["doctor"]);
    assert.ok(pkg.scripts["repair"]);
    assert.ok(pkg.scripts["backup"]);
    assert.ok(pkg.scripts["restore"]);
  });

  it("cli help lists doctor repair backup commands", () => {
    const cli = fs.readFileSync(path.join(root, "tools/windows-installer/src/cli.ts"), "utf8");
    assert.match(cli, /doctor/);
    assert.match(cli, /repair/);
    assert.match(cli, /backup/);
    assert.match(cli, /restore/);
    assert.match(cli, /diagnostics/);
    assert.match(cli, /repair-pnpm-path/);
  });
});
