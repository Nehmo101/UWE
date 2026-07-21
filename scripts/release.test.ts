import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "..");

function readJson(relativePath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8")) as Record<
    string,
    unknown
  >;
}

describe("release packaging", () => {
  it("keeps VERSION in sync with root package.json", () => {
    const versionFile = fs.readFileSync(path.join(root, "VERSION"), "utf8").trim();
    const packageJson = readJson("package.json");

    assert.equal(versionFile, packageJson.version);
  });

  it("never ships an active Command Center updater without a signing pubkey", () => {
    const tauriConf = readJson("apps/rtx-connector-client/src-tauri/tauri.conf.json");
    const updater = ((tauriConf.plugins as Record<string, unknown> | undefined)?.updater ??
      {}) as { active?: boolean; pubkey?: string };
    if (updater.active === true) {
      assert.ok(
        typeof updater.pubkey === "string" && updater.pubkey.trim().length > 0,
        "updater.active is true but pubkey is empty — unsigned updates would be accepted",
      );
    }
  });

  it("keeps a non-null CSP on the Command Center webview", () => {
    const tauriConf = readJson("apps/rtx-connector-client/src-tauri/tauri.conf.json");
    const security = ((tauriConf.app as Record<string, unknown> | undefined)?.security ??
      {}) as { csp?: unknown };
    assert.ok(
      typeof security.csp === "string" && security.csp.length > 0,
      "Command Center webview must define an explicit CSP (not null)",
    );
  });

  it("includes release documentation files", () => {
    assert.ok(fs.existsSync(path.join(root, "CHANGELOG.md")));
    assert.ok(fs.existsSync(path.join(root, "SECURITY.md")));
    assert.ok(fs.existsSync(path.join(root, "docs/PRODUCTION.md")));
    assert.ok(fs.existsSync(path.join(root, "VERSION")));
  });

  it("does not commit secrets in example or release files", () => {
    const envExample = fs.readFileSync(path.join(root, ".env.example"), "utf8");
    assert.doesNotMatch(envExample, /sk-[a-zA-Z0-9]{20,}/);
    assert.doesNotMatch(envExample, /SESSION_SECRET=super-secret/);
    assert.match(envExample, /generate-a-random-secret/);
    assert.ok(fs.existsSync(path.join(root, "docs/secrets.md")));
    assert.ok(fs.existsSync(path.join(root, "packages/env/src/config/env.ts")));

    // A local .env is expected for development (`cp .env.example .env`).
    // What must never happen is .env being tracked by git.
    const trackedFiles = execFileSync("git", ["ls-files", ".env", ".env.*"], {
      cwd: root,
      encoding: "utf8",
    })
      .split("\n")
      .filter(Boolean);
    const trackedSecrets = trackedFiles.filter(
      (file) => file !== ".env.example" && file !== ".env.production.example",
    );
    assert.deepEqual(trackedSecrets, [], ".env files must not be committed to git");
  });

  it("documents backup and update guidance in production docs", () => {
    const production = fs.readFileSync(path.join(root, "docs/PRODUCTION.md"), "utf8");
    assert.match(production, /Backup vor Updates/i);
    assert.match(production, /Update-Anleitung/i);
    assert.match(production, /Troubleshooting/i);
    assert.match(production, /Smoke-Check/i);
    assert.match(production, /UWE_DATA_DIR/i);
    assert.match(production, /Healthcheck/i);
    assert.match(production, /uploads/i);
  });

  it("CHANGELOG mentions current version", () => {
    const version = fs.readFileSync(path.join(root, "VERSION"), "utf8").trim();
    const changelog = fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8");
    assert.match(changelog, new RegExp(`\\[${version.replace(".", "\\.")}\\]`));
  });

  it("ships a Windows GitHub Release workflow and manifest builder", () => {
    const workflow = fs.readFileSync(
      path.join(root, ".github/workflows/uwe-windows-release.yml"),
      "utf8",
    );
    assert.match(workflow, /UWE Windows Release/);
    assert.match(workflow, /uwe-v/);
    assert.match(workflow, /softprops\/action-gh-release/);
    assert.match(workflow, /tauri:build/);
    assert.ok(fs.existsSync(path.join(root, "scripts/build-uwe-release-manifest.mjs")));
    assert.ok(
      fs.existsSync(path.join(root, "tools/uwe-host-command-center/src/desktop-host-update.ts")),
    );
    assert.ok(
      fs.existsSync(path.join(root, "tools/uwe-host-command-center/src/desktop-host-cli.ts")),
    );
  });

  it("keeps Command Center update docs aligned with release tags", () => {
    const docs = fs.readFileSync(
      path.join(root, "docs/engineering/rtx-connector-release.md"),
      "utf8",
    );
    assert.match(docs, /uwe-vX\.Y\.Z/);
    assert.match(docs, /Update installieren/);
    assert.match(docs, /uwe-windows-release\.yml/);
  });
});
