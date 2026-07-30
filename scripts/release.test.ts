import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
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

  // ── Manifest v2 + Bundle-Installation ────────────────────────────────────
  // Der Windows-Installer lädt App-Bundles nach und prüft sie gegen das
  // Manifest. Diese Tests nageln den Vertrag fest: schemaVersion 2 mit
  // Prüfsummen je Asset, ein Workflow, der alle fünf Bundles publiziert, und
  // die Gates des Manifest-Skripts (Exit 1 statt stilles Weiterlaufen).

  it("builds a schemaVersion-2 manifest with per-asset checksums and runtime info", () => {
    const werk = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-manifest-test-"));
    try {
      const bundle = path.join(werk, "uwe-studio-9.9.9.tar.gz");
      fs.writeFileSync(bundle, "test-bundle-inhalt");
      const out = path.join(werk, "uwe-release.json");
      execFileSync(
        process.execPath,
        [
          path.join(root, "scripts/build-uwe-release-manifest.mjs"),
          "--version", "9.9.9",
          "--app", `studio=${bundle}`,
          "--out", out,
        ],
        { stdio: "pipe" },
      );
      const manifest = JSON.parse(fs.readFileSync(out, "utf8")) as {
        schemaVersion: number;
        tag: string;
        runtime: { node: string; nodeAbi: string; platform: string; arch: string };
        apps: Record<string, { file: string; sha256: string; size: number }>;
      };
      assert.equal(manifest.schemaVersion, 2);
      assert.equal(manifest.tag, "uwe-v9.9.9");
      assert.equal(manifest.runtime.node, process.versions.node);
      assert.equal(manifest.runtime.nodeAbi, process.versions.modules);
      assert.equal(manifest.apps.studio.file, "uwe-studio-9.9.9.tar.gz");
      assert.match(manifest.apps.studio.sha256, /^[0-9a-f]{64}$/);
      assert.equal(manifest.apps.studio.size, fs.statSync(bundle).size);
    } finally {
      fs.rmSync(werk, { recursive: true, force: true });
    }
  });

  it("rejects unknown apps, missing files and a mismatched node version", () => {
    const skript = path.join(root, "scripts/build-uwe-release-manifest.mjs");
    const laeufe: string[][] = [
      ["--version", "9.9.9", "--app", "nichtexistent=egal.tar.gz"],
      ["--version", "9.9.9", "--app", "studio=diese-datei-fehlt.tar.gz"],
      ["--version", "9.9.9", "--node-version", "0.0.1"],
    ];
    for (const args of laeufe) {
      assert.throws(
        () => execFileSync(process.execPath, [skript, ...args, "--out", "unbenutzt.json"], { stdio: "pipe" }),
        `Manifest-Skript hätte abbrechen müssen: ${args.join(" ")}`,
      );
    }
  });

  it("publishes all five app bundles plus databases in the release workflow", () => {
    const workflow = fs.readFileSync(
      path.join(root, ".github/workflows/uwe-windows-release.yml"),
      "utf8",
    );
    assert.match(workflow, /build-release-bundles\.mjs/);
    for (const app of ["studio", "portal", "brain", "family", "landing"]) {
      assert.match(workflow, new RegExp(app), `Workflow nennt App-Bundle ${app} nicht`);
    }
    assert.match(workflow, /uwe-databases-/);
    assert.match(workflow, /host-runtime/);
    assert.match(workflow, /bundle-cli/);
  });

  it("keeps the bundled host runtime wired: CLI bundling, Rust fallback, Tauri resources", () => {
    assert.ok(fs.existsSync(path.join(root, "tools/uwe-host-command-center/scripts/bundle-cli.mjs")));
    assert.ok(fs.existsSync(path.join(root, "tools/uwe-host-command-center/src/bundle-install.ts")));
    assert.ok(fs.existsSync(path.join(root, "tools/uwe-host-command-center/src/bundle-update.ts")));

    const rust = fs.readFileSync(
      path.join(root, "apps/rtx-connector-client/src-tauri/src/command_center.rs"),
      "utf8",
    );
    assert.match(rust, /bundled_host_runtime_dir/);
    assert.match(rust, /host-cli\.cjs/);

    const tauriConf = readJson("apps/rtx-connector-client/src-tauri/tauri.conf.json");
    const bundleConf = tauriConf.bundle as { resources?: string[]; targets?: string[] };
    assert.ok(
      bundleConf.resources?.includes("resources/host-runtime"),
      "tauri.conf.json bündelt resources/host-runtime nicht",
    );
    assert.deepEqual(bundleConf.targets, ["nsis", "msi"]);
  });
});
