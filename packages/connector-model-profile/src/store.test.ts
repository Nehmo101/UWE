import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { modelProfileKey } from "./key";
import {
  ConnectorModelProfileError,
  createModelProfile,
  defaultModelProfileStore,
  enabledProfiles,
  parseModelProfileStore,
} from "./store";
import { MODEL_PROFILE_STORE_VERSION } from "./types";

describe("defaultModelProfileStore", () => {
  it("returns an empty versioned store", () => {
    const store = defaultModelProfileStore();
    assert.equal(store.version, MODEL_PROFILE_STORE_VERSION);
    assert.deepEqual(store.profiles, []);
    assert.deepEqual(store.scanPaths, []);
  });
});

describe("createModelProfile", () => {
  it("applies safe defaults and a derived id", () => {
    const profile = createModelProfile({ provider: "ollama", name: "llama3.2" });
    assert.equal(profile.id, modelProfileKey("ollama", "llama3.2"));
    assert.equal(profile.displayName, "llama3.2");
    assert.equal(profile.enabledForUwe, false);
    assert.equal(profile.visibleInModelPicker, true);
    assert.equal(profile.modelType, "other");
    assert.equal(profile.path, null);
    assert.deepEqual(profile.bestFor, []);
  });

  it("folds the path into the id and dedupes tags", () => {
    const profile = createModelProfile({
      provider: "filesystem",
      name: "model.gguf",
      path: "/models/model.gguf",
      tags: ["dnd", "dnd", "chat"],
      enabledForUwe: true,
    });
    assert.equal(profile.id, modelProfileKey("filesystem", "model.gguf", "/models/model.gguf"));
    assert.deepEqual(profile.tags, ["dnd", "chat"]);
    assert.equal(profile.enabledForUwe, true);
  });
});

describe("parseModelProfileStore", () => {
  it("returns defaults for nullish input", () => {
    assert.deepEqual(parseModelProfileStore(null), defaultModelProfileStore());
    assert.deepEqual(parseModelProfileStore(undefined), defaultModelProfileStore());
  });

  it("rejects non-object JSON", () => {
    assert.throws(
      () => parseModelProfileStore("nope"),
      (error: unknown) => {
        assert.ok(error instanceof ConnectorModelProfileError);
        assert.match(error.message, /JSON-Objekt/);
        return true;
      },
    );
  });

  it("normalizes profiles, drops malformed entries, and recomputes ids", () => {
    const store = parseModelProfileStore({
      version: 1,
      profiles: [
        {
          provider: "ollama",
          name: "qwen2.5",
          displayName: "Qwen 2.5",
          bestFor: ["DnD generator", 42, "  "],
          modelType: "chat",
          enabledForUwe: true,
          contextLength: 32768,
          unknownKey: "ignored",
        },
        { provider: "ollama" }, // missing name -> dropped
        "not-an-object", // dropped
      ],
      scanPaths: [
        { path: "/models", enabled: true, label: "Local" },
        { path: "" }, // dropped
      ],
    });

    assert.equal(store.profiles.length, 1);
    const [profile] = store.profiles;
    assert.equal(profile.id, modelProfileKey("ollama", "qwen2.5"));
    assert.equal(profile.displayName, "Qwen 2.5");
    assert.deepEqual(profile.bestFor, ["DnD generator"]);
    assert.equal(profile.modelType, "chat");
    assert.equal(profile.enabledForUwe, true);
    assert.equal(profile.contextLength, 32768);

    assert.equal(store.scanPaths.length, 1);
    assert.equal(store.scanPaths[0].path, "/models");
    assert.equal(store.scanPaths[0].label, "Local");
  });

  it("falls back to safe values for unknown enums", () => {
    const store = parseModelProfileStore({
      profiles: [
        { provider: "x", name: "m", source: "bogus", modelType: "bogus" },
      ],
    });
    assert.equal(store.profiles[0].source, "manual");
    assert.equal(store.profiles[0].modelType, "other");
  });

  it("deduplicates profiles sharing a key", () => {
    const store = parseModelProfileStore({
      profiles: [
        { provider: "ollama", name: "dupe", displayName: "First" },
        { provider: "ollama", name: "dupe", displayName: "Second" },
      ],
    });
    assert.equal(store.profiles.length, 1);
    assert.equal(store.profiles[0].displayName, "First");
  });
});

describe("enabledProfiles", () => {
  it("returns only profiles enabled for UWE", () => {
    const store = {
      ...defaultModelProfileStore(),
      profiles: [
        createModelProfile({ provider: "ollama", name: "a", enabledForUwe: true }),
        createModelProfile({ provider: "ollama", name: "b", enabledForUwe: false }),
      ],
    };
    const enabled = enabledProfiles(store);
    assert.equal(enabled.length, 1);
    assert.equal(enabled[0].name, "a");
  });
});
