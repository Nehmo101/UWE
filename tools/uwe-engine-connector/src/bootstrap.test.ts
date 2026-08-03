import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";

import {
  CONNECTOR_VERSION,
  createConnectorRunner,
  loadConnectorEnvFile,
} from "./bootstrap";
import { configureConnectorLogFile } from "./logging";

const CONNECTOR_ENV_KEYS = [
  "UWE_HOST_URL",
  "UWE_CONNECTOR_TOKEN",
  "UWE_CONNECTOR_NAME",
  "UWE_CONNECTOR_QUEUE_ENABLED",
  "UWE_CONNECTOR_CAPABILITIES",
  "UWE_CONNECTOR_POLL_MS",
  "UWE_CONNECTOR_HEARTBEAT_MS",
  "UWE_CONNECTOR_CLIENT_DATA_DIR",
  "BOOTSTRAP_TEST_ONLY",
  "BOOTSTRAP_PREEXISTING",
];

let savedEnv: Record<string, string | undefined> = {};
let tmpDir: string;

beforeEach(() => {
  savedEnv = {};
  for (const key of CONNECTOR_ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  tmpDir = mkdtempSync(join(tmpdir(), "uwe-connector-bootstrap-"));
});

afterEach(() => {
  for (const key of CONNECTOR_ENV_KEYS) {
    if (savedEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = savedEnv[key];
    }
  }
  // Reset the module-global log sink so other test files are unaffected.
  configureConnectorLogFile(null);
  rmSync(tmpDir, { recursive: true, force: true });
});

function writeEnv(contents: string): string {
  const path = join(tmpDir, ".env");
  writeFileSync(path, contents, "utf8");
  return path;
}

test("CONNECTOR_VERSION is the published connector version", () => {
  assert.equal(CONNECTOR_VERSION, "1.0.0");
});

test("loadConnectorEnvFile returns empty map when the file is missing", () => {
  const parsed = loadConnectorEnvFile(join(tmpDir, "does-not-exist.env"));
  assert.deepEqual(parsed, {});
});

test("loadConnectorEnvFile parses, trims quotes, and skips comments/blanks", () => {
  const path = writeEnv(
    [
      "# a comment",
      "",
      'UWE_HOST_URL="https://host.test"',
      "UWE_CONNECTOR_TOKEN='uwec_secret'",
      "BOOTSTRAP_TEST_ONLY=plain",
      "no_equals_sign",
    ].join("\n"),
  );

  const parsed = loadConnectorEnvFile(path);

  assert.equal(parsed.UWE_HOST_URL, "https://host.test");
  assert.equal(parsed.UWE_CONNECTOR_TOKEN, "uwec_secret");
  assert.equal(parsed.BOOTSTRAP_TEST_ONLY, "plain");
  assert.equal(parsed.no_equals_sign, undefined);
  assert.equal(process.env.UWE_HOST_URL, "https://host.test");
  assert.equal(process.env.BOOTSTRAP_TEST_ONLY, "plain");
});

test("loadConnectorEnvFile never overrides an existing process env value", () => {
  process.env.BOOTSTRAP_PREEXISTING = "from-process";
  const path = writeEnv("BOOTSTRAP_PREEXISTING=from-file");

  const parsed = loadConnectorEnvFile(path);

  // The file value is reported as parsed, but the process value is preserved.
  assert.equal(parsed.BOOTSTRAP_PREEXISTING, "from-file");
  assert.equal(process.env.BOOTSTRAP_PREEXISTING, "from-process");
});

test("createConnectorRunner returns an error result when config is incomplete", () => {
  const result = createConnectorRunner({
    envPath: join(tmpDir, "missing.env"),
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.reason, /UWE_HOST_URL/);
  }
});

test("createConnectorRunner builds a runner and resolved config from the env file", () => {
  // Point the client data dir at the temp dir so model store / job history /
  // log files never touch the real home directory during tests.
  process.env.UWE_CONNECTOR_CLIENT_DATA_DIR = tmpDir;
  const path = writeEnv(
    [
      "UWE_HOST_URL=https://host.test/",
      "UWE_CONNECTOR_TOKEN=uwec_secret",
      "UWE_CONNECTOR_NAME=My Maschinenraum",
      "UWE_CONNECTOR_POLL_MS=1234",
    ].join("\n"),
  );

  const result = createConnectorRunner({ envPath: path });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.config.hostUrl, "https://host.test");
    assert.equal(result.config.token, "uwec_secret");
    assert.equal(result.config.name, "My Maschinenraum");
    assert.equal(result.config.pollIntervalMs, 1234);
    assert.ok(result.discoveryConfig.ollamaUrl);
    assert.equal(result.dataDir, tmpDir);
    assert.equal(typeof result.runner.refresh, "function");
    assert.equal(result.runner.activeJobCount, 0);
  }
});
