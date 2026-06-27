import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const cliPath = resolve(here, "client-cli.ts");

function runCli(args: string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, ["--import", "tsx", cliPath, ...args], {
    encoding: "utf8",
    // Force offline runner endpoints so probes fail fast (connection refused),
    // keeping the integration test quick and deterministic.
    env: {
      ...process.env,
      OLLAMA_BASE_URL: "http://127.0.0.1:9",
      LM_STUDIO_BASE_URL: "http://127.0.0.1:9",
      LLAMACPP_BASE_URL: "http://127.0.0.1:9",
    },
  });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

describe("client-cli cookbook-dashboard", () => {
  it("emits a JSON dashboard with hardware, recommendations and fit-scored models", () => {
    const { status, stdout, stderr } = runCli(["cookbook-dashboard"]);
    assert.equal(status, 0, `cookbook-dashboard failed: ${stderr}`);

    const dashboard = JSON.parse(stdout.trim());

    assert.ok(dashboard.hardware, "hardware present");
    assert.equal(typeof dashboard.hardware.backend, "string");
    assert.ok(Array.isArray(dashboard.installedModels));
    assert.ok(Array.isArray(dashboard.recommendations));
    assert.ok(Array.isArray(dashboard.models));
    assert.ok(dashboard.models.length > 0, "registry models present");

    const sample = dashboard.models[0];
    assert.equal(typeof sample.id, "string");
    assert.equal(typeof sample.installed, "boolean");
    assert.ok(sample.fit, "model carries a fit result");
    assert.equal(typeof sample.fit.score, "number");
    assert.equal(typeof sample.fit.level, "string");
  });
});

describe("client-cli probe-runners", () => {
  it("reports offline runners as JSON when nothing is listening", () => {
    const { status, stdout, stderr } = runCli(["probe-runners"]);
    assert.equal(status, 0, `probe-runners failed: ${stderr}`);

    const payload = JSON.parse(stdout.trim());
    assert.ok(Array.isArray(payload.runners));
    assert.equal(payload.runners.length, 3);
    for (const runner of payload.runners) {
      assert.equal(runner.status, "offline");
    }
  });
});
