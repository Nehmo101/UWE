import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
    assert.equal(
      resolveConnectorDataDir({ UWE_CONNECTOR_CLIENT_DATA_DIR: "/tmp/uwe-data" }),
      "/tmp/uwe-data",
    );
  });

  it("falls back to a per-user directory when unset", () => {
    const resolved = resolveConnectorDataDir({});
    assert.match(resolved, /\.uwe-rtx-connector$/);
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
