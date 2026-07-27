import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import {
  DEFAULT_MANAGED_CHALLENGE_SKIP_PATHS,
  MANAGED_CHALLENGE_RULE_DESCRIPTION,
  MANAGED_CHALLENGE_RULE_REF,
  buildManagedChallengeExpression,
  collectManagedChallengeIssues,
  hasActiveManagedChallenge,
  mergeManagedChallengeRule,
  normalizeChallengeHostname,
  normalizeChallengeSkipPath,
  normalizeManagedChallengeConfig,
  parseListInput,
} from "./managed-challenge";
import {
  readManagedChallengeConfig,
  resolveManagedChallengeConfigPath,
  writeManagedChallengeConfig,
} from "./config-file";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-cf-edge-"));
  tempDirs.push(dir);
  return dir;
}

after(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("hostname normalisation", () => {
  it("accepts bare hostnames and full URLs", () => {
    assert.equal(normalizeChallengeHostname("studio.uweanddragons.org"), "studio.uweanddragons.org");
    assert.equal(normalizeChallengeHostname("  Portal.UweAndDragons.org "), "portal.uweanddragons.org");
    assert.equal(
      normalizeChallengeHostname("https://studio.uweanddragons.org/system/cloudflare"),
      "studio.uweanddragons.org",
    );
    assert.equal(normalizeChallengeHostname("https://uweanddragons.org:8443/"), "uweanddragons.org");
  });

  it("rejects anything that could break out of the expression", () => {
    assert.equal(normalizeChallengeHostname('evil" or true or "'), null);
    assert.equal(normalizeChallengeHostname("localhost"), null, "single label has no dot");
    assert.equal(normalizeChallengeHostname("-bad.example.org"), null);
    assert.equal(normalizeChallengeHostname(""), null);
    assert.equal(normalizeChallengeHostname(42), null);
  });
});

describe("skip path normalisation", () => {
  it("adds the leading slash and trims trailing ones", () => {
    assert.equal(normalizeChallengeSkipPath("api/health"), "/api/health");
    assert.equal(normalizeChallengeSkipPath("/api/health/"), "/api/health");
    assert.equal(normalizeChallengeSkipPath("/"), "/");
  });

  it("rejects quotes, spaces and query strings", () => {
    assert.equal(normalizeChallengeSkipPath('/api" or true or "'), null);
    assert.equal(normalizeChallengeSkipPath("/api/health?x=1"), null);
    assert.equal(normalizeChallengeSkipPath("/api health"), null);
  });
});

describe("config normalisation", () => {
  it("drops invalid entries, dedupes and sorts", () => {
    const config = normalizeManagedChallengeConfig({
      enabled: true,
      hostnames: ["portal.uweanddragons.org", "studio.uweanddragons.org", "portal.uweanddragons.org", "nope"],
      skipPaths: ["/api/health", "/api/health"],
      action: "js_challenge",
    });

    assert.deepEqual(config.hostnames, ["portal.uweanddragons.org", "studio.uweanddragons.org"]);
    assert.deepEqual(config.skipPaths, ["/api/health"]);
    assert.equal(config.action, "js_challenge");
    assert.equal(config.enabled, true);
  });

  it("defaults to disabled with the machine-client skip paths", () => {
    const config = normalizeManagedChallengeConfig(undefined);
    assert.equal(config.enabled, false);
    assert.deepEqual(config.hostnames, []);
    assert.deepEqual(config.skipPaths, [...DEFAULT_MANAGED_CHALLENGE_SKIP_PATHS].sort());
    assert.equal(config.action, "managed_challenge");
  });

  it("coerces an unknown action to the safe managed_challenge", () => {
    assert.equal(normalizeManagedChallengeConfig({ action: "block" }).action, "managed_challenge");
  });

  it("parses textarea input by line and comma", () => {
    assert.deepEqual(parseListInput(" a.example.org\n b.example.org , c.example.org \n\n"), [
      "a.example.org",
      "b.example.org",
      "c.example.org",
    ]);
    assert.deepEqual(parseListInput(""), []);
  });

  it("reports dropped entries so the UI can explain them", () => {
    const issues = collectManagedChallengeIssues(["good.example.org", "bad host"], ["/ok", "no quotes\""]);
    assert.equal(issues.length, 2);
    assert.ok(issues[0]?.includes("bad host"));
    assert.ok(issues[1]?.includes("no quotes"));
  });
});

describe("expression builder", () => {
  it("matches the hostnames and exempts the skip paths", () => {
    const config = normalizeManagedChallengeConfig({
      enabled: true,
      hostnames: ["studio.uweanddragons.org", "portal.uweanddragons.org"],
      skipPaths: ["/api/health"],
    });

    assert.equal(
      buildManagedChallengeExpression(config),
      '(http.host in {"portal.uweanddragons.org" "studio.uweanddragons.org"}) and not (starts_with(http.request.uri.path, "/api/health"))',
    );
  });

  it("omits the not-clause when nothing is exempt", () => {
    const config = normalizeManagedChallengeConfig({
      enabled: true,
      hostnames: ["uweanddragons.org"],
      skipPaths: [],
    });
    assert.equal(buildManagedChallengeExpression(config), '(http.host in {"uweanddragons.org"})');
  });

  it("never emits a bare quote from hostile input", () => {
    const config = normalizeManagedChallengeConfig({
      enabled: true,
      hostnames: ['a.example.org" or ip.src eq 1.2.3.4 or "'],
      skipPaths: [],
    });
    assert.deepEqual(config.hostnames, []);
    assert.equal(hasActiveManagedChallenge(config), false);
  });
});

describe("rule merge", () => {
  const foreign = [
    { id: "rule-1", action: "block", expression: "ip.src eq 1.2.3.4", description: "Operator-Regel" },
  ];

  it("appends the UWE rule and keeps foreign rules untouched", () => {
    const config = normalizeManagedChallengeConfig({
      enabled: true,
      hostnames: ["studio.uweanddragons.org"],
      skipPaths: [],
    });
    const merged = mergeManagedChallengeRule(foreign, config);

    assert.equal(merged.length, 2);
    assert.deepEqual(merged[0], foreign[0]);
    assert.equal(merged[1]?.ref, MANAGED_CHALLENGE_RULE_REF);
    assert.equal(merged[1]?.description, MANAGED_CHALLENGE_RULE_DESCRIPTION);
    assert.equal(merged[1]?.action, "managed_challenge");
    assert.equal(merged[1]?.enabled, true);
  });

  it("replaces the existing UWE rule in place, keeping its id", () => {
    const existing = [
      ...foreign,
      { id: "uwe-1", ref: MANAGED_CHALLENGE_RULE_REF, action: "js_challenge", expression: "old" },
    ];
    const config = normalizeManagedChallengeConfig({
      enabled: true,
      hostnames: ["studio.uweanddragons.org"],
      skipPaths: [],
    });
    const merged = mergeManagedChallengeRule(existing, config);

    assert.equal(merged.length, 2);
    assert.equal(merged[1]?.id, "uwe-1");
    assert.equal(merged[1]?.action, "managed_challenge");
    assert.equal(merged[1]?.expression, '(http.host in {"studio.uweanddragons.org"})');
  });

  it("removes the UWE rule when disabled — and only that one", () => {
    const existing = [...foreign, { id: "uwe-1", ref: MANAGED_CHALLENGE_RULE_REF, action: "managed_challenge" }];
    const merged = mergeManagedChallengeRule(existing, normalizeManagedChallengeConfig({ enabled: false }));
    assert.deepEqual(merged, foreign);
  });

  it("removes the rule when enabled but no hostname is configured", () => {
    const existing = [{ id: "uwe-1", ref: MANAGED_CHALLENGE_RULE_REF, action: "managed_challenge" }];
    const merged = mergeManagedChallengeRule(
      existing,
      normalizeManagedChallengeConfig({ enabled: true, hostnames: [] }),
    );
    assert.deepEqual(merged, []);
  });

  it("also recognises a legacy rule that only carries the description", () => {
    const existing = [{ id: "uwe-legacy", description: MANAGED_CHALLENGE_RULE_DESCRIPTION }];
    const merged = mergeManagedChallengeRule(existing, normalizeManagedChallengeConfig({ enabled: false }));
    assert.deepEqual(merged, []);
  });
});

describe("host-readable config file", () => {
  it("round-trips the normalised config", () => {
    const dir = makeTempDir();
    const written = writeManagedChallengeConfig(
      normalizeManagedChallengeConfig({
        enabled: true,
        hostnames: ["studio.uweanddragons.org"],
        skipPaths: ["/api/health"],
        action: "managed_challenge",
      }),
      dir,
    );

    assert.equal(written, resolveManagedChallengeConfigPath(dir));
    assert.ok(fs.existsSync(written));

    const read = readManagedChallengeConfig(dir);
    assert.equal(read.enabled, true);
    assert.deepEqual(read.hostnames, ["studio.uweanddragons.org"]);
    assert.deepEqual(read.skipPaths, ["/api/health"]);
  });

  it("never persists a secret-looking field", () => {
    const dir = makeTempDir();
    writeManagedChallengeConfig(
      normalizeManagedChallengeConfig({
        enabled: true,
        hostnames: ["studio.uweanddragons.org"],
        apiToken: "must-not-be-written",
      }),
      dir,
    );

    const raw = fs.readFileSync(resolveManagedChallengeConfigPath(dir), "utf-8");
    assert.ok(!raw.includes("must-not-be-written"));
    assert.ok(!raw.toLowerCase().includes("token"));
  });

  it("falls back to the disabled default for a missing or corrupt file", () => {
    const dir = makeTempDir();
    assert.equal(readManagedChallengeConfig(dir).enabled, false);

    const configPath = resolveManagedChallengeConfigPath(dir);
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, "{ not json", "utf-8");
    assert.equal(readManagedChallengeConfig(dir).enabled, false);
  });
});
