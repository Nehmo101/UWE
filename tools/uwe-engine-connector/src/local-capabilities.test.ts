import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createModelProfile, type ConnectorModelProfile } from "@uwe/connector-model-profile";

import {
  detectCapabilities,
  resolveCapabilityEnv,
  sanitizePrintersForPrivacy,
  type CapabilityEnv,
} from "./local-capabilities";
import type { LocalLlmSummary } from "./llm-discovery";

const emptyLlms: LocalLlmSummary = {
  providers: [],
  models: [],
  hasChat: false,
  hasEmbeddings: false,
  hasVision: false,
};

function env(overrides: Partial<CapabilityEnv> = {}): CapabilityEnv {
  return {
    audioEnabled: false,
    audioCommandConfigured: false,
    spotifyEnabled: false,
    spotifyBackendConfigured: false,
    imageEnabled: false,
    imageExecutorConfigured: false,
    systemInfoEnabled: true,
    fileCacheEnabled: false,
    printAllowed: true,
    printEnabled: false,
    printBackendConfigured: false,
    privacyModeEnabled: false,
    ...overrides,
  };
}

function summary(provider: string, capabilities: string[]): LocalLlmSummary {
  return {
    providers: [{ provider, status: "ready", models: [] }],
    models: [
      {
        provider,
        name: `${provider}-model`,
        status: "ready",
        capabilities,
      },
    ],
    hasChat: capabilities.includes("chat"),
    hasEmbeddings: capabilities.includes("embeddings"),
    hasVision: capabilities.includes("vision"),
  };
}

function enabledProfileFor(
  provider: string,
  name: string,
  extra: Partial<ConnectorModelProfile> = {},
): ConnectorModelProfile {
  return {
    ...createModelProfile({ provider, name, enabledForUwe: true }),
    ...extra,
  };
}

describe("detectCapabilities — environment backends", () => {
  it("does not advertise audio_local without a configured audio command", () => {
    assert.equal(resolveCapabilityEnv({ UWE_CONNECTOR_AUDIO: "true" }).audioEnabled, false);
    assert.equal(
      resolveCapabilityEnv({ UWE_CONNECTOR_AUDIO_CMD: "mpv --no-video" }).audioEnabled,
      true,
    );

    const detected = detectCapabilities(emptyLlms, env({ audioEnabled: false }));
    assert.deepEqual(detected.capabilities, ["system_info"]);
  });

  it("advertises audio_local when an executable audio backend is configured", () => {
    const detected = detectCapabilities(
      emptyLlms,
      env({ audioEnabled: true, audioCommandConfigured: true }),
    );
    assert.deepEqual(detected.capabilities, ["audio_local", "system_info"]);
  });

  it("advertises spotify_connect only with token and device id", () => {
    const detected = detectCapabilities(
      emptyLlms,
      env({ spotifyEnabled: true, spotifyBackendConfigured: true }),
    );
    assert.deepEqual(detected.capabilities, ["spotify_connect", "system_info"]);
  });

  it("advertises image_generation only with a configured image command", () => {
    const detected = detectCapabilities(
      emptyLlms,
      env({ imageEnabled: true, imageExecutorConfigured: true }),
    );
    assert.deepEqual(detected.capabilities, ["image_generation", "system_info"]);
  });

  it("does not let forced capabilities advertise missing backends", () => {
    const detected = detectCapabilities(emptyLlms, env(), {
      forced: ["image_generation", "spotify_connect", "system_info"],
    });
    assert.deepEqual(detected.capabilities, ["system_info"]);
  });
});

describe("detectCapabilities — local LLM capabilities require an enabled profile", () => {
  it("does NOT advertise llm_local for a discovered Ollama chat model without an enabled profile", () => {
    const detected = detectCapabilities(summary("ollama", ["chat"]), env());
    assert.deepEqual(detected.capabilities, ["system_info"]);
    assert.deepEqual(detected.models, []);
  });

  it("advertises llm_local only for enabled Ollama chat models", () => {
    const detected = detectCapabilities(summary("ollama", ["chat"]), env(), {
      profiles: [enabledProfileFor("ollama", "ollama-model", { modelType: "chat" })],
    });
    assert.deepEqual(detected.capabilities, ["llm_local", "system_info"]);
  });

  it("advertises embedding_local only for enabled Ollama embedding models", () => {
    const detected = detectCapabilities(summary("ollama", ["embeddings"]), env(), {
      profiles: [enabledProfileFor("ollama", "ollama-model", { modelType: "embedding" })],
    });
    assert.deepEqual(detected.capabilities, ["embedding_local", "system_info"]);
  });

  it("advertises llm_local for enabled LM Studio chat models", () => {
    const detected = detectCapabilities(summary("lmstudio", ["chat"]), env(), {
      profiles: [enabledProfileFor("lmstudio", "lmstudio-model", { modelType: "chat" })],
    });
    assert.deepEqual(detected.capabilities, ["llm_local", "system_info"]);
  });

  it("advertises embedding_local for enabled llama.cpp embedding models", () => {
    const detected = detectCapabilities(summary("llamacpp", ["embeddings"]), env(), {
      profiles: [enabledProfileFor("llamacpp", "llamacpp-model", { modelType: "embedding" })],
    });
    assert.deepEqual(detected.capabilities, ["embedding_local", "system_info"]);
  });
});

describe("detectCapabilities — heartbeat model list", () => {
  it("sends ONLY enabled profiles, merged with discovery metadata", () => {
    const profiles = [
      enabledProfileFor("ollama", "ollama-model", {
        displayName: "Llama (enabled)",
        description: "Local chat model",
        bestFor: ["DnD generator"],
        modelType: "chat",
        contextLength: 8192,
      }),
      // A profile that exists but is NOT enabled must never be advertised.
      { ...createModelProfile({ provider: "ollama", name: "secret-model" }), enabledForUwe: false },
    ];

    const detected = detectCapabilities(summary("ollama", ["chat"]), env(), { profiles });

    assert.equal(detected.models.length, 1);
    const [model] = detected.models;
    assert.equal(model.name, "ollama-model");
    assert.equal(model.enabledForUwe, true);
    assert.equal(model.displayName, "Llama (enabled)");
    assert.deepEqual(model.bestFor, ["DnD generator"]);
    assert.equal(model.modelType, "chat");
    // Discovery metadata is merged in.
    assert.equal(model.status, "ready");
    assert.deepEqual(model.capabilities, ["chat"]);
    // Falls back to the profile context length when discovery has none.
    assert.equal(model.contextLength, 8192);
  });

  it("sends full metadata when privacy mode is off (default)", () => {
    assert.equal(resolveCapabilityEnv({}).privacyModeEnabled, false);
    assert.equal(resolveCapabilityEnv({ UWE_CONNECTOR_PRIVACY_MODE: "false" }).privacyModeEnabled, false);

    const detected = detectCapabilities(summary("ollama", ["chat"]), env(), {
      profiles: [
        enabledProfileFor("ollama", "ollama-model", {
          displayName: "Llama (enabled)",
          description: "Local chat model",
          modelType: "chat",
          contextLength: 8192,
        }),
      ],
    });
    const [model] = detected.models;
    assert.equal(model.displayName, "Llama (enabled)");
    assert.equal(model.description, "Local chat model");
    assert.equal(model.contextLength, 8192);
    assert.equal(model.status, "ready");
    assert.equal(model.modelType, "chat");
  });

  it("still advertises an enabled profile that is not currently discovered (offline model)", () => {
    const detected = detectCapabilities(emptyLlms, env(), {
      profiles: [
        enabledProfileFor("ollama", "offline-model", {
          modelType: "chat",
          contextLength: 4096,
        }),
      ],
    });
    // Capability is gated on a *ready* discovered model, so llm_local is absent…
    assert.deepEqual(detected.capabilities, ["system_info"]);
    // …but the enabled profile is still listed (without a live status).
    assert.equal(detected.models.length, 1);
    assert.equal(detected.models[0].name, "offline-model");
    assert.equal(detected.models[0].status, undefined);
    assert.equal(detected.models[0].contextLength, 4096);
  });
});

describe("detectCapabilities — privacy mode (UWE_CONNECTOR_PRIVACY_MODE)", () => {
  it("parses the env flag (default false)", () => {
    assert.equal(resolveCapabilityEnv({ UWE_CONNECTOR_PRIVACY_MODE: "true" }).privacyModeEnabled, true);
    assert.equal(resolveCapabilityEnv({ UWE_CONNECTOR_PRIVACY_MODE: " TRUE " }).privacyModeEnabled, true);
    assert.equal(resolveCapabilityEnv({ UWE_CONNECTOR_PRIVACY_MODE: "" }).privacyModeEnabled, false);
    assert.equal(resolveCapabilityEnv({}).privacyModeEnabled, false);
  });

  it("strips model metadata to routing essentials, keeping capabilities intact", () => {
    const profiles = [
      enabledProfileFor("ollama", "ollama-model", {
        displayName: "Llama (enabled)",
        description: "Local chat model",
        bestFor: ["DnD generator"],
        modelType: "chat",
        contextLength: 8192,
      }),
    ];

    const detected = detectCapabilities(summary("ollama", ["chat"]), env({ privacyModeEnabled: true }), {
      profiles,
    });

    // WHICH capabilities are advertised must not change in privacy mode.
    assert.deepEqual(detected.capabilities, ["llm_local", "system_info"]);

    assert.equal(detected.models.length, 1);
    const [model] = detected.models;
    // Routing essentials survive …
    assert.equal(model.id, profiles[0].id);
    assert.equal(model.provider, "ollama");
    assert.equal(model.name, "ollama-model");
    assert.deepEqual(model.capabilities, ["chat"]);
    assert.equal(model.enabledForUwe, true);
    // … everything descriptive/telemetry is omitted.
    assert.deepEqual(Object.keys(model).sort(), [
      "capabilities",
      "enabledForUwe",
      "id",
      "name",
      "provider",
    ]);
    assert.equal(model.displayName, undefined);
    assert.equal(model.description, undefined);
    assert.equal(model.bestFor, undefined);
    assert.equal(model.contextLength, undefined);
    assert.equal(model.status, undefined);
    assert.equal(model.modelType, undefined);
  });

  it("keeps embeddings routing information for enabled embedding models", () => {
    const detected = detectCapabilities(
      summary("ollama", ["embeddings"]),
      env({ privacyModeEnabled: true }),
      { profiles: [enabledProfileFor("ollama", "ollama-model", { modelType: "embedding" })] },
    );
    assert.deepEqual(detected.capabilities, ["embedding_local", "system_info"]);
    assert.deepEqual(detected.models[0].capabilities, ["embeddings"]);
  });
});

describe("detectCapabilities — label_printing gating", () => {
  const printer = { id: "zebra-lp2844", name: "Zebra LP 2844" };

  it("advertises label_printing for an env-configured print backend", () => {
    const detected = detectCapabilities(emptyLlms, env({ printEnabled: true, printBackendConfigured: true }));
    assert.ok(detected.capabilities.includes("label_printing"));
  });

  it("advertises label_printing when the user selected printers (no env backend)", () => {
    const detected = detectCapabilities(emptyLlms, env(), {
      printers: [printer],
      printersSelected: true,
    });
    assert.ok(detected.capabilities.includes("label_printing"));
    assert.deepEqual(detected.printers, [printer]);
  });

  it("does NOT advertise label_printing for auto-detected printers that were not selected", () => {
    const detected = detectCapabilities(emptyLlms, env(), {
      printers: [printer],
      printersSelected: false,
    });
    assert.ok(!detected.capabilities.includes("label_printing"));
    // …but the printers are still forwarded on heartbeat.
    assert.deepEqual(detected.printers, [printer]);
  });

  it("respects UWE_CONNECTOR_PRINT=false even with selected printers", () => {
    const detected = detectCapabilities(emptyLlms, env({ printAllowed: false }), {
      printers: [printer],
      printersSelected: true,
    });
    assert.ok(!detected.capabilities.includes("label_printing"));
  });
});

describe("sanitizePrintersForPrivacy", () => {
  const printers = [
    { id: "zebra-lp2844", name: "Zebra LP 2844", description: "Zebra on USB001", isDefault: true, state: "idle" },
    { id: "hp-lj", name: "HP LaserJet", state: "printing" },
  ];

  it("returns printers unchanged when privacy mode is off", () => {
    assert.deepEqual(sanitizePrintersForPrivacy(printers, false), printers);
  });

  it("drops description and live state in privacy mode, keeping id/name/default", () => {
    assert.deepEqual(sanitizePrintersForPrivacy(printers, true), [
      { id: "zebra-lp2844", name: "Zebra LP 2844", isDefault: true },
      { id: "hp-lj", name: "HP LaserJet" },
    ]);
  });
});
