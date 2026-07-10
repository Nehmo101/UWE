import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  readBackupScheduleConfig,
  resolveScheduleConfigPath,
  writeBackupScheduleConfig,
  type BackupScheduleConfig,
  type BackupScheduleFrequency,
} from "./schedule";

// These env vars would override baseDir-based path resolution; clear them so the
// tests stay fully isolated inside a per-test temp directory.
const PATH_ENV_VARS = ["UWE_DATA_DIR", "UWE_BACKUP_DIR", "BACKUPS_DIR"] as const;

let baseDir: string;
const savedEnv = new Map<string, string | undefined>();

beforeEach(() => {
  for (const key of PATH_ENV_VARS) {
    savedEnv.set(key, process.env[key]);
    delete process.env[key];
  }
  baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-schedule-"));
});

afterEach(() => {
  for (const key of PATH_ENV_VARS) {
    const original = savedEnv.get(key);
    if (original === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original;
    }
  }
  savedEnv.clear();
  fs.rmSync(baseDir, { recursive: true, force: true });
});

/** Write a raw JSON blob straight to the resolved config path (bypassing sanitizing writer). */
function writeRawConfig(raw: string): void {
  const configPath = resolveScheduleConfigPath(baseDir);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, raw, "utf-8");
}

describe("resolveScheduleConfigPath", () => {
  it("resolves schedule.json inside the given baseDir", () => {
    const configPath = resolveScheduleConfigPath(baseDir);
    assert.ok(configPath.startsWith(baseDir), `${configPath} should be under ${baseDir}`);
    assert.equal(path.basename(configPath), "schedule.json");
  });
});

describe("write -> read round-trip", () => {
  const frequencies: BackupScheduleFrequency[] = ["daily", "weekly", "monthly"];

  for (const frequency of frequencies) {
    it(`preserves { enabled: true, frequency: ${frequency} }`, () => {
      const config: BackupScheduleConfig = { enabled: true, frequency };
      writeBackupScheduleConfig(config, baseDir);
      assert.deepEqual(readBackupScheduleConfig(baseDir), config);
    });

    it(`preserves { enabled: false, frequency: ${frequency} }`, () => {
      const config: BackupScheduleConfig = { enabled: false, frequency };
      writeBackupScheduleConfig(config, baseDir);
      assert.deepEqual(readBackupScheduleConfig(baseDir), config);
    });
  }

  it("actually persists a file on disk that reads back identically", () => {
    const config: BackupScheduleConfig = { enabled: false, frequency: "weekly" };
    writeBackupScheduleConfig(config, baseDir);

    const configPath = resolveScheduleConfigPath(baseDir);
    assert.ok(fs.existsSync(configPath));
    const onDisk = JSON.parse(fs.readFileSync(configPath, "utf-8")) as BackupScheduleConfig;
    assert.deepEqual(onDisk, config);
    assert.deepEqual(readBackupScheduleConfig(baseDir), config);
  });
});

describe("default when no file exists", () => {
  it("returns { enabled: true, frequency: daily }", () => {
    assert.deepEqual(readBackupScheduleConfig(baseDir), {
      enabled: true,
      frequency: "daily",
    });
  });
});

describe("invalid / unknown frequency falls back to daily", () => {
  it("sanitizes an unknown frequency on write", () => {
    writeBackupScheduleConfig(
      { enabled: true, frequency: "hourly" as BackupScheduleFrequency },
      baseDir,
    );

    const configPath = resolveScheduleConfigPath(baseDir);
    const onDisk = JSON.parse(fs.readFileSync(configPath, "utf-8")) as BackupScheduleConfig;
    assert.equal(onDisk.frequency, "daily");
    assert.equal(readBackupScheduleConfig(baseDir).frequency, "daily");
  });

  it("falls back to daily when reading an unknown frequency from a raw file", () => {
    writeRawConfig(JSON.stringify({ enabled: true, frequency: "yearly" }));
    assert.equal(readBackupScheduleConfig(baseDir).frequency, "daily");
  });

  it("falls back to daily when the frequency field is missing", () => {
    writeRawConfig(JSON.stringify({ enabled: false }));
    const result = readBackupScheduleConfig(baseDir);
    assert.equal(result.frequency, "daily");
    assert.equal(result.enabled, false);
  });
});

describe("enabled flag coercion", () => {
  it("only literal false disables; anything else is enabled", () => {
    writeRawConfig(JSON.stringify({ enabled: false, frequency: "weekly" }));
    assert.equal(readBackupScheduleConfig(baseDir).enabled, false);

    writeRawConfig(JSON.stringify({ enabled: true, frequency: "weekly" }));
    assert.equal(readBackupScheduleConfig(baseDir).enabled, true);
  });

  it("treats a non-boolean enabled value as enabled (enabled !== false)", () => {
    writeRawConfig(JSON.stringify({ enabled: "false", frequency: "daily" }));
    assert.equal(readBackupScheduleConfig(baseDir).enabled, true);
  });

  it("defaults enabled to true when the field is omitted", () => {
    writeRawConfig(JSON.stringify({ frequency: "monthly" }));
    const result = readBackupScheduleConfig(baseDir);
    assert.equal(result.enabled, true);
    assert.equal(result.frequency, "monthly");
  });

  it("normalizes a non-boolean enabled value to a real boolean on write", () => {
    writeBackupScheduleConfig(
      { enabled: "truthy" as unknown as boolean, frequency: "daily" },
      baseDir,
    );
    const configPath = resolveScheduleConfigPath(baseDir);
    const onDisk = JSON.parse(fs.readFileSync(configPath, "utf-8")) as BackupScheduleConfig;
    assert.equal(onDisk.enabled, true);
  });
});

describe("corrupt file handling", () => {
  it("falls back to defaults when the JSON is invalid", () => {
    writeRawConfig("{ not valid json");
    assert.deepEqual(readBackupScheduleConfig(baseDir), {
      enabled: true,
      frequency: "daily",
    });
  });
});
