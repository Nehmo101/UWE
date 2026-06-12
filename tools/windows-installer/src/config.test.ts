import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  defaultPortConfig,
  generateEnvContent,
  parseEnvFile,
  runDbSeedForMode,
  upsertEnvValue,
} from "./config.js";
import { resolveInstallPaths } from "./paths.js";

describe("config", () => {
  it("upserts env values", () => {
    const input = "AUTH_SECRET=old\nSTUDIO_PORT=3000\n";
    const output = upsertEnvValue(input, "AUTH_SECRET", "new-secret");
    assert.match(output, /AUTH_SECRET=new-secret/);
    assert.doesNotMatch(output, /AUTH_SECRET=old/);
  });

  it("parses env files", () => {
    const values = parseEnvFile("# comment\nAUTH_SECRET=abc\nPORTAL_PORT=3001\n");
    assert.equal(values.get("AUTH_SECRET"), "abc");
    assert.equal(values.get("PORTAL_PORT"), "3001");
  });

  it("uses false seed mode in release", () => {
    assert.equal(runDbSeedForMode("release"), "false");
    assert.equal(runDbSeedForMode("dev"), "auto");
  });

  it("generates env content with secure defaults", () => {
    const root = path.join(os.tmpdir(), `uwe-config-${process.pid}`);
    const paths = resolveInstallPaths(root);
    const result = generateEnvContent({
      paths,
      ports: defaultPortConfig(),
      mode: "release",
      dryRun: true,
    });

    assert.match(result.content, /AUTH_SECRET=/);
    assert.match(result.content, /RUN_DB_SEED=false/);
    assert.match(result.content, /DATABASE_URL=file:/);
    assert.equal(result.warnings.length, 0);
  });
});
