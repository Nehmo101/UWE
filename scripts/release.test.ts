import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
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

/**
 * Ein Wegwerf-Abbild der Dateien, die `set-release-version.mjs` anfasst — damit
 * die Tests des Skripts nie das echte Repo verändern.
 */
function makeVersionFixture(): { dir: string; skript: string; git: (...args: string[]) => string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-setversion-"));
  const tauriDir = path.join(dir, "apps/rtx-connector-client/src-tauri");
  fs.mkdirSync(tauriDir, { recursive: true });
  fs.writeFileSync(path.join(dir, "VERSION"), "0.1.0\n");
  fs.writeFileSync(path.join(dir, "package.json"), '{\n  "version": "0.1.0"\n}\n');
  fs.writeFileSync(
    path.join(dir, "apps/rtx-connector-client/package.json"),
    '{\n  "version": "0.1.0"\n}\n',
  );
  fs.writeFileSync(path.join(tauriDir, "tauri.conf.json"), '{\n  "version": "0.1.0"\n}\n');
  fs.writeFileSync(
    path.join(tauriDir, "Cargo.toml"),
    '[package]\nname = "x"\nversion = "0.1.0"\n\n[dependencies]\nserde = { version = "1.0.0" }\n',
  );
  fs.writeFileSync(
    path.join(dir, "CHANGELOG.md"),
    "# Changelog\n\n## [Unreleased]\n\n### Added\n\n- Neues Ding\n\n## [0.1.0] - 2026-06-11\n\n- Erstes Release\n",
  );
  // Das Skript rechnet relativ zu seinem eigenen Ort — also mitkopieren.
  fs.mkdirSync(path.join(dir, "scripts"), { recursive: true });
  const skript = path.join(dir, "scripts/set-release-version.mjs");
  fs.copyFileSync(path.join(root, "scripts/set-release-version.mjs"), skript);

  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  return { dir, skript, git };
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
    // Den Tag setzt die Pipeline; der Tag-Push ist der zweite Eingang.
    assert.match(docs, /pnpm release:version/);
    assert.match(docs, /git push origin uwe-v/);
  });

  // ── Release über Release-Tags ────────────────────────────────────────────
  // Ein gepushter `uwe-vX.Y.Z` muss genau das Release erzeugen, das das Command
  // Center erwartet: derselbe Tag, dieselbe Version wie im Commit, kein Draft.

  it("lets the pipeline create the tag and accepts a pushed one", () => {
    const workflow = fs.readFileSync(
      path.join(root, ".github/workflows/uwe-windows-release.yml"),
      "utf8",
    );
    // Der reguläre Weg: Lauf starten, die gh-release-Action legt den Tag an.
    assert.match(workflow, /workflow_dispatch:/);
    assert.match(workflow, /softprops\/action-gh-release/);
    assert.match(workflow, /tag_name: \$\{\{ steps\.meta\.outputs\.tag \}\}/);
  });

  it("publishes on a pushed uwe-v tag, not only by hand", () => {
    const workflow = fs.readFileSync(
      path.join(root, ".github/workflows/uwe-windows-release.yml"),
      "utf8",
    );
    assert.match(workflow, /^on:/m);
    assert.match(workflow, /^\s{2}push:/m, "Workflow reagiert nicht auf einen Tag-Push");
    assert.match(workflow, /tags:\s*\n\s*- "uwe-v/, "Tag-Filter fehlt oder passt nicht auf uwe-v*");
    assert.match(workflow, /workflow_dispatch:/, "Der manuelle Weg muss erhalten bleiben");
    // Der Tag benennt die Version; der Commit muss sie tragen.
    assert.match(workflow, /GITHUB_REF_TYPE/);
    assert.match(workflow, /GITHUB_REF_NAME/);
    assert.match(workflow, /tag_name: \$\{\{ steps\.meta\.outputs\.tag \}\}/);
  });

  it("never publishes a draft on a tag push", () => {
    // /releases/latest/download/uwe-release.json — der Pfad, über den eine
    // Bundle-Installation ihr Manifest zieht — kennt nur veröffentlichte
    // Releases. Ein Draft wäre für den Update-Knopf unsichtbar.
    const workflow = fs.readFileSync(
      path.join(root, ".github/workflows/uwe-windows-release.yml"),
      "utf8",
    );
    assert.match(workflow, /draft: \$\{\{ inputs\.draft == true \}\}/);
  });

  it("syncs the Rust crate version so the app reports the release version", () => {
    // Das Command Center meldet dem Update-Check seine Fassung aus
    // CARGO_PKG_VERSION. Bliebe Cargo.toml stehen, hielte sich eine
    // Bundle-Installation für dauerhaft veraltet. Build und Versions-PR
    // benutzen dasselbe Skript, damit die Regel nur einmal existiert.
    const workflow = fs.readFileSync(
      path.join(root, ".github/workflows/uwe-windows-release.yml"),
      "utf8",
    );
    assert.match(workflow, /set-release-version\.mjs/);
    assert.ok(fs.existsSync(path.join(root, "scripts/set-release-version.mjs")));
    assert.equal(
      (readJson("package.json").scripts as Record<string, string>)["release:version"],
      "node scripts/set-release-version.mjs",
    );

    const rust = fs.readFileSync(
      path.join(root, "apps/rtx-connector-client/src-tauri/src/command_center.rs"),
      "utf8",
    );
    assert.match(rust, /CARGO_PKG_VERSION/);
    assert.match(
      rust,
      /UWE_COMMAND_CENTER_VERSION/,
      "Die Fassung der App wird nicht an die Host-CLI durchgereicht",
    );
  });

  it("keeps all five version files on one version", () => {
    // Genau die Prüfung, die `pnpm release:version --check` fährt — hier als
    // Gate, damit ein halber Bump nicht durch die CI kommt.
    const result = spawnSync(
      process.execPath,
      [path.join(root, "scripts/set-release-version.mjs"), "--check"],
      { cwd: root, encoding: "utf8" },
    );
    assert.equal(result.status, 0, `set-release-version --check: ${result.stderr || result.stdout}`);
    assert.match(result.stdout, new RegExp(fs.readFileSync(path.join(root, "VERSION"), "utf8").trim()));
  });

  it("set-release-version writes every file and rejects a non-semver argument", () => {
    const { dir, skript } = makeVersionFixture();
    try {
      execFileSync(process.execPath, [skript, "2.3.4"], { stdio: "pipe" });
      assert.equal(fs.readFileSync(path.join(dir, "VERSION"), "utf8").trim(), "2.3.4");
      for (const file of [
        "package.json",
        "apps/rtx-connector-client/package.json",
        "apps/rtx-connector-client/src-tauri/tauri.conf.json",
      ]) {
        assert.equal(JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")).version, "2.3.4");
      }
      const cargo = fs.readFileSync(
        path.join(dir, "apps/rtx-connector-client/src-tauri/Cargo.toml"),
        "utf8",
      );
      assert.match(cargo, /^version = "2\.3\.4"$/m);
      // Die Version der Abhängigkeit bleibt unangetastet.
      assert.match(cargo, /serde = \{ version = "1\.0\.0" \}/);
      // Ohne --pr bleibt der CHANGELOG unberührt — das ist der Workflow-Pfad.
      assert.doesNotMatch(fs.readFileSync(path.join(dir, "CHANGELOG.md"), "utf8"), /\[2\.3\.4\]/);

      // Kein Semver, keine Änderung.
      assert.throws(() => execFileSync(process.execPath, [skript, "v2.3"], { stdio: "pipe" }));

      // Drift wird gemeldet.
      fs.writeFileSync(path.join(dir, "VERSION"), "2.3.5\n");
      assert.throws(() => execFileSync(process.execPath, [skript, "--check"], { stdio: "pipe" }));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("--pr promotes the changelog, branches and commits — but never pushes", () => {
    const { dir, skript, git } = makeVersionFixture();
    try {
      git("init", "-q");
      git("config", "user.email", "test@uwe.local");
      git("config", "user.name", "Test");
      git("checkout", "-q", "-b", "main");
      git("add", "-A");
      git("commit", "-qm", "init");

      const ausgabe = execFileSync(process.execPath, [skript, "0.2.0", "--pr"], {
        cwd: dir,
        encoding: "utf8",
      });

      assert.equal(git("rev-parse", "--abbrev-ref", "HEAD"), "release/v0.2.0");
      assert.equal(git("log", "-1", "--pretty=%s"), "chore(release): v0.2.0");
      assert.equal(git("status", "--porcelain"), "", "der Commit nimmt alles mit");

      // Keep a Changelog: Unreleased-Text wandert unter die neue Fassung, darüber
      // bleibt ein leeres Unreleased stehen.
      const changelog = fs.readFileSync(path.join(dir, "CHANGELOG.md"), "utf8");
      assert.match(changelog, /## \[Unreleased\]\n\n## \[0\.2\.0\] - \d{4}-\d{2}-\d{2}\n/);
      assert.match(changelog, /## \[0\.2\.0\][\s\S]*- Neues Ding/);
      assert.match(changelog, /## \[0\.2\.0\][\s\S]*## \[0\.1\.0\]/, "ältere Fassung bleibt darunter");
      // Genau das, was `CHANGELOG mentions current version` verlangt.
      assert.equal(fs.readFileSync(path.join(dir, "VERSION"), "utf8").trim(), "0.2.0");

      // Der Push bleibt beim Menschen — das Skript nennt ihn nur.
      assert.match(ausgabe, /git push -u origin release\/v0\.2\.0/);
      assert.equal(git("log", "--oneline", "main", "-1").includes("init"), true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("--pr refuses a dirty tree, an existing branch and a taken version", () => {
    const { dir, skript, git } = makeVersionFixture();
    const lauf = (...args: string[]) =>
      spawnSync(process.execPath, [skript, ...args], { cwd: dir, encoding: "utf8" });
    try {
      git("init", "-q");
      git("config", "user.email", "test@uwe.local");
      git("config", "user.name", "Test");
      git("checkout", "-q", "-b", "main");
      git("add", "-A");
      git("commit", "-qm", "init");

      // Fremdes im Baum darf nicht im Release-Commit landen.
      fs.writeFileSync(path.join(dir, "fremd.txt"), "x\n");
      const dreckig = lauf("0.2.0", "--pr");
      assert.equal(dreckig.status, 1);
      assert.match(dreckig.stderr, /nicht sauber/);
      fs.rmSync(path.join(dir, "fremd.txt"));

      // Branch existiert schon.
      git("branch", "release/v0.2.0");
      const belegt = lauf("0.2.0", "--pr");
      assert.equal(belegt.status, 1);
      assert.match(belegt.stderr, /existiert schon/);
      git("branch", "-D", "release/v0.2.0");

      // Fassung steht schon im CHANGELOG — und es entsteht kein halber Branch.
      fs.writeFileSync(
        path.join(dir, "CHANGELOG.md"),
        "# Changelog\n\n## [Unreleased]\n\n## [0.2.0] - 2026-01-01\n\n- schon da\n",
      );
      git("commit", "-qam", "changelog");
      const doppelt = lauf("0.2.0", "--pr");
      assert.equal(doppelt.status, 1);
      assert.match(doppelt.stderr, /bereits einen Abschnitt/);
      assert.equal(git("rev-parse", "--abbrev-ref", "HEAD"), "main", "kein Branch bei Abbruch");
      assert.equal(git("status", "--porcelain"), "", "keine halben Änderungen");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("resolves release assets without the gh CLI", () => {
    // Auf einem Zielrechner gibt es kein `gh` und kein Token: Der Update-Check
    // muss den Installer-Namen aus uwe-release.json lesen.
    const update = fs.readFileSync(
      path.join(root, "tools/uwe-host-command-center/src/desktop-host-update.ts"),
      "utf8",
    );
    assert.doesNotMatch(update, /spawnSync\(\s*\n?\s*"gh"/);
    assert.match(update, /tryFetchManifestForTag/);
    // Eine Bundle-Installation hat kein git — ihr Check läuft über das Manifest.
    assert.match(update, /detectHostMode\(root\) === "bundle"/);
    assert.match(update, /checkBundleUpdate/);
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
