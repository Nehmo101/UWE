import assert from "node:assert/strict";
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

  it("includes release documentation files", () => {
    assert.ok(fs.existsSync(path.join(root, "CHANGELOG.md")));
    assert.ok(fs.existsSync(path.join(root, "SECURITY.md")));
    assert.ok(fs.existsSync(path.join(root, "docs/PRODUCTION.md")));
    assert.ok(fs.existsSync(path.join(root, "VERSION")));
  });

  it("does not commit secrets in example or release files", () => {
    const envExample = fs.readFileSync(path.join(root, ".env.example"), "utf8");
    assert.doesNotMatch(envExample, /sk-[a-zA-Z0-9]{20,}/);
    assert.doesNotMatch(envExample, /AUTH_SECRET=super-secret/);
    assert.match(envExample, /generate-a-random-secret/);

    const trackedEnv = path.join(root, ".env");
    assert.ok(!fs.existsSync(trackedEnv), ".env must not be committed");
  });

  it("documents backup and update guidance in production docs", () => {
    const production = fs.readFileSync(path.join(root, "docs/PRODUCTION.md"), "utf8");
    assert.match(production, /Backup vor Updates/i);
    assert.match(production, /Update-Anleitung/i);
    assert.match(production, /Troubleshooting/i);
    assert.match(production, /Healthcheck/i);
    assert.match(production, /uploads/i);
  });

  it("CHANGELOG mentions current version", () => {
    const version = fs.readFileSync(path.join(root, "VERSION"), "utf8").trim();
    const changelog = fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8");
    assert.match(changelog, new RegExp(`\\[${version.replace(".", "\\.")}\\]`));
  });
});
