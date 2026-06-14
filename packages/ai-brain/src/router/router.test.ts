import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createTestDatabaseUrl } from "@uwe/database/test-helpers";
import { createUweRepository, seedTerraWorld } from "@uwe/database/server";
import { AiPrivacyError } from "../types";
import { InMemoryApiKeyStore } from "../settings";
import {
  AiRouterError,
  validateContextModeRequirements,
  validateLocalRtxRequired,
  validateProviderContextCombination,
  validateResolvedRouteForContext,
  contextModeRequiresLocalContext,
  isCloudRouteAllowedForContext,
  providerIdToMode,
  legacyContextMode,
  resolveProviderRoute,
  routeAiRequest,
  type AiContextMode,
  type AiProviderMode,
} from "./index";

const INFERENCE_ENV_KEYS = [
  "AI_INFERENCE_ENABLED",
  "AI_INFERENCE_BASE_URL",
  "AI_INFERENCE_PROVIDER",
  "AI_INFERENCE_DEFAULT_MODEL",
  "AI_INFERENCE_ALLOW_PUBLIC_URL",
  "AI_BRAIN_ENABLED",
  "RTX_AGENT_URL",
  "RTX_AGENT_TOKEN",
] as const;

const originalEnv: Record<string, string | undefined> = {};
let originalFetch: typeof globalThis.fetch;

function snapshotEnv() {
  for (const key of INFERENCE_ENV_KEYS) {
    originalEnv[key] = process.env[key];
  }
}

function restoreEnv() {
  for (const key of INFERENCE_ENV_KEYS) {
    if (originalEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalEnv[key];
    }
  }
}

function configureOfflineRtxEnv() {
  delete process.env.RTX_AGENT_URL;
  delete process.env.RTX_AGENT_TOKEN;
  process.env.AI_INFERENCE_ENABLED = "true";
  process.env.AI_BRAIN_ENABLED = "true";
  process.env.AI_INFERENCE_BASE_URL = "http://192.168.178.50:11434";
  process.env.AI_INFERENCE_PROVIDER = "ollama";
  process.env.AI_INFERENCE_DEFAULT_MODEL = "llama3.2";
  globalThis.fetch = async () => {
    throw new TypeError("fetch failed");
  };
}

function cloudKeyStore(): InMemoryApiKeyStore {
  const store = new InMemoryApiKeyStore();
  store.set("openai", "test-openai-key");
  return store;
}

type RouteExpectation =
  | { outcome: "allowed"; route: "local_rtx" | "cloud"; via: "resolveProviderRoute" }
  | { outcome: "blocked"; error: typeof AiPrivacyError | typeof AiRouterError; via: "privacyGuard" | "resolveProviderRoute" };

const PROVIDER_CONTEXT_MATRIX: Array<{
  id: number;
  provider: AiProviderMode;
  context: AiContextMode;
  rtxReady: boolean;
  cloudAvailable: boolean;
  expect: RouteExpectation;
}> = [
  { id: 1, provider: "cloud", context: "general_chat", rtxReady: false, cloudAvailable: true, expect: { outcome: "allowed", route: "cloud", via: "resolveProviderRoute" } },
  { id: 2, provider: "cloud", context: "brain", rtxReady: true, cloudAvailable: true, expect: { outcome: "blocked", error: AiPrivacyError, via: "privacyGuard" } },
  { id: 3, provider: "cloud", context: "current_object", rtxReady: true, cloudAvailable: true, expect: { outcome: "blocked", error: AiPrivacyError, via: "privacyGuard" } },
  { id: 4, provider: "cloud", context: "current_object_plus_brain", rtxReady: true, cloudAvailable: true, expect: { outcome: "blocked", error: AiPrivacyError, via: "privacyGuard" } },
  { id: 5, provider: "local_rtx", context: "general_chat", rtxReady: true, cloudAvailable: false, expect: { outcome: "allowed", route: "local_rtx", via: "resolveProviderRoute" } },
  { id: 6, provider: "local_rtx", context: "brain", rtxReady: true, cloudAvailable: false, expect: { outcome: "allowed", route: "local_rtx", via: "resolveProviderRoute" } },
  { id: 7, provider: "local_rtx", context: "current_object", rtxReady: true, cloudAvailable: false, expect: { outcome: "allowed", route: "local_rtx", via: "resolveProviderRoute" } },
  { id: 8, provider: "local_rtx", context: "current_object_plus_brain", rtxReady: true, cloudAvailable: false, expect: { outcome: "allowed", route: "local_rtx", via: "resolveProviderRoute" } },
  { id: 9, provider: "auto", context: "general_chat", rtxReady: true, cloudAvailable: true, expect: { outcome: "allowed", route: "local_rtx", via: "resolveProviderRoute" } },
  { id: 10, provider: "auto", context: "general_chat", rtxReady: false, cloudAvailable: true, expect: { outcome: "allowed", route: "cloud", via: "resolveProviderRoute" } },
  { id: 11, provider: "auto", context: "brain", rtxReady: true, cloudAvailable: true, expect: { outcome: "allowed", route: "local_rtx", via: "resolveProviderRoute" } },
  { id: 12, provider: "auto", context: "brain", rtxReady: false, cloudAvailable: true, expect: { outcome: "blocked", error: AiRouterError, via: "resolveProviderRoute" } },
  { id: 13, provider: "auto", context: "current_object", rtxReady: false, cloudAvailable: true, expect: { outcome: "blocked", error: AiRouterError, via: "resolveProviderRoute" } },
  { id: 14, provider: "auto", context: "current_object_plus_brain", rtxReady: false, cloudAvailable: true, expect: { outcome: "blocked", error: AiRouterError, via: "resolveProviderRoute" } },
  { id: 15, provider: "cloud", context: "personal_brain", rtxReady: true, cloudAvailable: true, expect: { outcome: "blocked", error: AiPrivacyError, via: "privacyGuard" } },
  { id: 16, provider: "auto", context: "personal_brain", rtxReady: false, cloudAvailable: true, expect: { outcome: "blocked", error: AiRouterError, via: "resolveProviderRoute" } },
  { id: 17, provider: "local_rtx", context: "personal_brain", rtxReady: true, cloudAvailable: false, expect: { outcome: "allowed", route: "local_rtx", via: "resolveProviderRoute" } },
];

async function resolveRouteForScenario(
  provider: AiProviderMode,
  context: AiContextMode,
  rtxReady: boolean,
  cloudAvailable: boolean,
) {
  const store = cloudAvailable ? cloudKeyStore() : new InMemoryApiKeyStore();

  if (rtxReady) {
    return resolveProviderRoute(provider, context, store, { useMock: true });
  }

  snapshotEnv();
  configureOfflineRtxEnv();
  try {
    return await resolveProviderRoute(provider, context, store, { useMock: false });
  } finally {
    restoreEnv();
    globalThis.fetch = originalFetch;
  }
}

describe("AI Router — Privacy Guard", () => {
  it("blocks cloud provider with brain context", () => {
    assert.throws(
      () => validateProviderContextCombination("cloud", "brain"),
      (error: unknown) => {
        assert.ok(error instanceof AiPrivacyError);
        assert.match((error as AiPrivacyError).message, /Cloud-KI darf keinen lokalen Kontext/);
        return true;
      },
    );
  });

  it("blocks cloud provider with current_object context", () => {
    assert.throws(
      () => validateProviderContextCombination("cloud", "current_object"),
      (error: unknown) => error instanceof AiPrivacyError,
    );
  });

  it("blocks cloud provider with current_object_plus_brain context", () => {
    assert.throws(
      () => validateProviderContextCombination("cloud", "current_object_plus_brain"),
      (error: unknown) => error instanceof AiPrivacyError,
    );
  });

  it("allows cloud provider with general_chat only", () => {
    assert.doesNotThrow(() => validateProviderContextCombination("cloud", "general_chat"));
  });

  it("allows local_rtx with all context modes at validation layer", () => {
    const modes = [
      "general_chat",
      "brain",
      "current_object",
      "current_object_plus_brain",
    ] as const;
    for (const mode of modes) {
      assert.doesNotThrow(() => validateProviderContextCombination("local_rtx", mode));
    }
  });

  it("validateResolvedRouteForContext blocks cloud route for local context", () => {
    assert.throws(
      () => validateResolvedRouteForContext("cloud", "brain"),
      (error: unknown) => error instanceof AiPrivacyError,
    );
  });

  it("requires pageSlug for object context modes", () => {
    assert.throws(
      () => validateContextModeRequirements("current_object"),
      (error: unknown) => error instanceof AiRouterError,
    );
    assert.throws(
      () => validateContextModeRequirements("current_object_plus_brain"),
      (error: unknown) => error instanceof AiRouterError,
    );
    assert.doesNotThrow(() => validateContextModeRequirements("current_object", "validori"));
  });

  it("contextModeRequiresLocalContext identifies protected modes", () => {
    assert.equal(contextModeRequiresLocalContext("general_chat"), false);
    assert.equal(contextModeRequiresLocalContext("brain"), true);
    assert.equal(isCloudRouteAllowedForContext("general_chat"), true);
    assert.equal(isCloudRouteAllowedForContext("brain"), false);
  });

  it("validateLocalRtxRequired enforces RTX for local context in auto mode", () => {
    assert.throws(
      () => validateLocalRtxRequired("auto", "brain", false),
      (error: unknown) => error instanceof AiRouterError,
    );
    assert.doesNotThrow(() => validateLocalRtxRequired("auto", "general_chat", false));
    assert.throws(
      () => validateLocalRtxRequired("local_rtx", "general_chat", false),
      (error: unknown) => error instanceof AiRouterError,
    );
  });
});

describe("AI Router — provider/context matrix (14 cases)", () => {
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    restoreEnv();
  });

  for (const scenario of PROVIDER_CONTEXT_MATRIX) {
    if (scenario.expect.outcome === "blocked" && scenario.expect.via === "privacyGuard") {
      it(`case ${scenario.id}: ${scenario.provider} + ${scenario.context} (RTX ${scenario.rtxReady ? "ready" : "offline"})`, () => {
        assert.throws(
          () => validateProviderContextCombination(scenario.provider, scenario.context),
          (error: unknown) => error instanceof scenario.expect.error,
        );
      });
      continue;
    }

    it(`case ${scenario.id}: ${scenario.provider} + ${scenario.context} (RTX ${scenario.rtxReady ? "ready" : "offline"})`, async () => {
      if (scenario.expect.outcome === "blocked") {
        await assert.rejects(
          () =>
            resolveRouteForScenario(
              scenario.provider,
              scenario.context,
              scenario.rtxReady,
              scenario.cloudAvailable,
            ),
          (error: unknown) => error instanceof scenario.expect.error,
        );
        return;
      }

      const resolution = await resolveRouteForScenario(
        scenario.provider,
        scenario.context,
        scenario.rtxReady,
        scenario.cloudAvailable,
      );
      assert.equal(resolution.route, scenario.expect.route);
    });
  }

  it("blocks local_rtx modes when RTX is offline", async () => {
    for (const context of ["general_chat", "brain", "current_object", "current_object_plus_brain"] as const) {
      await assert.rejects(
        () => resolveRouteForScenario("local_rtx", context, false, true),
        (error: unknown) => error instanceof AiRouterError,
      );
    }
  });
});

describe("AI Router — provider helpers", () => {
  it("maps legacy provider IDs to router modes", () => {
    assert.equal(providerIdToMode("ollama"), "local_rtx");
    assert.equal(providerIdToMode("openai_compatible"), "local_rtx");
    assert.equal(providerIdToMode("openai"), "cloud");
    assert.equal(providerIdToMode("anthropic"), "cloud");
  });

  it("maps legacy context modes", () => {
    assert.equal(legacyContextMode({ withBrain: false }), "current_object");
    assert.equal(legacyContextMode({ withBrain: true }), "current_object_plus_brain");
    assert.equal(legacyContextMode({ withBrain: false, generalChat: true }), "general_chat");
  });

  it("resolveProviderRoute cloud selects configured provider", async () => {
    const store = new InMemoryApiKeyStore();
    store.set("anthropic", "test-key");

    const resolution = await resolveProviderRoute("cloud", "general_chat", store, {
      useMock: true,
      cloudProviderId: "anthropic",
    });

    assert.equal(resolution.route, "cloud");
    assert.equal(resolution.providerId, "anthropic");
  });
});

describe("AI Router — cloud regression (no brain data)", () => {
  let databaseUrl: string;

  beforeEach(() => {
    databaseUrl = createTestDatabaseUrl();
    originalFetch = globalThis.fetch;
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    const { createPrismaClient } = await import("@uwe/database/server");
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("routeAiRequest cloud + general_chat strips campaign context before provider call", async () => {
    const repo = createUweRepository(databaseUrl);
    const seeded = await seedTerraWorld(repo);
    const store = cloudKeyStore();

    const result = await routeAiRequest(
      { repo },
      {
        providerMode: "cloud",
        contextMode: "general_chat",
        taskType: "summarize_page",
        worldSlug: seeded.world.slug,
        pageSlug: seeded.pages.validori.slug,
        userPrompt: "Allgemeine Frage ohne Kontext",
        apiKeyStore: store,
        useMock: true,
        cloudProviderId: "openai",
      },
    );

    assert.equal(result.route, "cloud");
    assert.equal(result.context.pages.length, 0);
    assert.equal(result.context.brainEntries?.length ?? 0, 0);
    assert.doesNotMatch(result.prompts.userPrompt, /Validori|Magister|GM-only|dm_only/i);
    assert.doesNotMatch(result.prompts.systemPrompt, /Validori|Magister/i);
  });

  it("routeAiRequest blocks auto brain fallback when RTX offline", async () => {
    const repo = createUweRepository(databaseUrl);
    const seeded = await seedTerraWorld(repo);
    snapshotEnv();
    configureOfflineRtxEnv();

    try {
      await assert.rejects(
        () =>
          routeAiRequest(
            { repo },
            {
              providerMode: "auto",
              contextMode: "brain",
              taskType: "summarize_page",
              worldSlug: seeded.world.slug,
              pageSlug: seeded.pages.validori.slug,
              userPrompt: "Was weiß die Welt?",
              apiKeyStore: cloudKeyStore(),
              useMock: false,
            },
          ),
        (error: unknown) => error instanceof AiRouterError,
      );
    } finally {
      restoreEnv();
      globalThis.fetch = originalFetch;
    }
  });
});
