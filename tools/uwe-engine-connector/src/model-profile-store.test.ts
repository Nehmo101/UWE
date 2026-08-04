import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import { createModelProfile, defaultModelProfileStore } from "@uwe/connector-model-profile";

import {
  loadModelProfileStore,
  modelStorePath,
  resolveConnectorDataDir,
  saveModelProfileStore,
} from "./model-profile-store";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "uwe-model-store-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("resolveConnectorDataDir", () => {
  it("prefers UWE_CONNECTOR_CLIENT_DATA_DIR when set", () => {
    // `resolve` keeps the assertion platform-neutral (drive letter on Windows).
    assert.equal(
      resolveConnectorDataDir({ UWE_CONNECTOR_CLIENT_DATA_DIR: "/tmp/uwe-data" }),
      resolve("/tmp/uwe-data"),
    );
  });

  it("falls back to a per-user directory when unset", () => {
    const resolved = resolveConnectorDataDir({}, dir);
    assert.equal(resolved, join(dir, ".uwe-engine-connector"));
  });

  it("migrates the legacy RTX directory to the new fallback location", () => {
    const legacy = join(dir, ".uwe-rtx-connector");
    mkdirSync(legacy, { recursive: true });
    writeFileSync(join(legacy, "model-store.json"), '{"profiles":[]}', "utf8");

    const resolved = resolveConnectorDataDir({}, dir);

    assert.equal(resolved, join(dir, ".uwe-engine-connector"));
    assert.equal(existsSync(legacy), false);
    assert.equal(
      readFileSync(join(resolved, "model-store.json"), "utf8"),
      '{"profiles":[]}',
    );
  });

  it("leaves the legacy directory alone when the new one already exists", () => {
    const legacy = join(dir, ".uwe-rtx-connector");
    const current = join(dir, ".uwe-engine-connector");
    mkdirSync(legacy, { recursive: true });
    mkdirSync(current, { recursive: true });
    writeFileSync(join(legacy, "marker.txt"), "legacy", "utf8");
    writeFileSync(join(current, "marker.txt"), "current", "utf8");

    const resolved = resolveConnectorDataDir({}, dir);

    assert.equal(resolved, current);
    assert.equal(readFileSync(join(legacy, "marker.txt"), "utf8"), "legacy");
    assert.equal(readFileSync(join(current, "marker.txt"), "utf8"), "current");
  });

  it("never migrates when UWE_CONNECTOR_CLIENT_DATA_DIR is set", () => {
    const legacy = join(dir, ".uwe-rtx-connector");
    mkdirSync(legacy, { recursive: true });
    writeFileSync(join(legacy, "marker.txt"), "legacy", "utf8");
    const configured = join(dir, "configured-data");

    const resolved = resolveConnectorDataDir(
      { UWE_CONNECTOR_CLIENT_DATA_DIR: configured },
      dir,
    );

    assert.equal(resolved, configured);
    assert.equal(existsSync(legacy), true);
    assert.equal(existsSync(join(dir, ".uwe-engine-connector")), false);
  });
});

describe("loadModelProfileStore", () => {
  it("returns the empty default when the file is missing", () => {
    assert.deepEqual(loadModelProfileStore(dir), defaultModelProfileStore());
  });

  it("returns the default for a corrupt JSON file", () => {
    writeFileSync(modelStorePath(dir), "{ not json", "utf8");
    assert.deepEqual(loadModelProfileStore(dir), defaultModelProfileStore());
  });

  it("round-trips a saved store", () => {
    const store = {
      ...defaultModelProfileStore(),
      profiles: [
        createModelProfile({
          provider: "ollama",
          name: "llama3.2",
          enabledForUwe: true,
          modelType: "chat",
        }),
      ],
      scanPaths: [{ id: "s1", path: "/models", enabled: true, label: "Local" }],
    };

    saveModelProfileStore(dir, store);
    // File is created and is valid JSON.
    const onDisk = JSON.parse(readFileSync(modelStorePath(dir), "utf8"));
    assert.equal(onDisk.profiles[0].name, "llama3.2");

    const loaded = loadModelProfileStore(dir);
    assert.equal(loaded.profiles.length, 1);
    assert.equal(loaded.profiles[0].enabledForUwe, true);
    assert.equal(loaded.scanPaths[0].path, "/models");
  });
});
