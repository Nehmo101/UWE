import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  AiRouterError,
  validateContextModeRequirements,
  validateLocalRtxRequired,
  providerIdToMode,
  legacyContextMode,
  resolveProviderRoute,
  type AiContextMode,
} from "./index";

/**
 * Router behaviour after the cloud providers were removed.
 *
 * This file used to be a routing matrix: seventeen cases across provider mode ×
 * context mode × RTX availability, asserting which combinations were allowed to
 * leave the host. That matrix collapsed to a single row — the RTX host is the
 * only backend — so what is worth testing changed shape entirely:
 *
 *  - every request resolves to `local_rtx`, whatever the context mode
 *  - an unreachable RTX host fails fast instead of falling back anywhere
 *  - context modes still have to be handed the input they need
 */

const INFERENCE_ENV_KEYS = [
  "AI_INFERENCE_ENABLED",
  "AI_INFERENCE_BASE_URL",
  "AI_INFERENCE_PROVIDER",
  "AI_INFERENCE_DEFAULT_MODEL",
  "AI_INFERENCE_ALLOW_PUBLIC_URL",
  "AI_BRAIN_ENABLED",
  "RTX_BASE_URL",
  "RTX_SERVICE_TOKEN",
] as const;

const ALL_CONTEXT_MODES: AiContextMode[] = [
  "general_chat",
  "brain",
  "current_object",
  "current_object_plus_brain",
  "personal_brain",
  "mail",
];

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

function configureRtxEnv() {
  process.env.AI_INFERENCE_ENABLED = "true";
  process.env.AI_BRAIN_ENABLED = "true";
  process.env.AI_INFERENCE_BASE_URL = "http://192.168.178.50:11434";
  process.env.AI_INFERENCE_PROVIDER = "ollama";
  process.env.AI_INFERENCE_DEFAULT_MODEL = "llama3.2";
  delete process.env.RTX_BASE_URL;
  delete process.env.RTX_SERVICE_TOKEN;
}

function configureOfflineRtxEnv() {
  configureRtxEnv();
  globalThis.fetch = async () => {
    throw new TypeError("fetch failed");
  };
}

beforeEach(() => {
  snapshotEnv();
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  restoreEnv();
  globalThis.fetch = originalFetch;
});

describe("provider routing", () => {
  it("resolves every context mode to the local RTX route", async () => {
    configureRtxEnv();

    for (const contextMode of ALL_CONTEXT_MODES) {
      const resolution = await resolveProviderRoute(contextMode, { useMock: true });
      assert.equal(resolution.route, "local_rtx", `${contextMode} must route to RTX`);
    }
  });

  it("fails fast when the RTX host is unreachable — there is nothing to fall back to", async () => {
    configureOfflineRtxEnv();

    for (const contextMode of ALL_CONTEXT_MODES) {
      await assert.rejects(
        () => resolveProviderRoute(contextMode, { useMock: false }),
        AiRouterError,
        `${contextMode} must fail when RTX is offline`,
      );
    }
  });

  it("reports local_rtx for every provider id", () => {
    assert.equal(providerIdToMode("local_rtx"), "local_rtx");
    assert.equal(providerIdToMode("ollama"), "local_rtx");
  });
});

describe("context mode requirements", () => {
  it("requires a page for object-scoped modes", () => {
    assert.throws(() => validateContextModeRequirements("current_object"), AiRouterError);
    assert.throws(
      () => validateContextModeRequirements("current_object_plus_brain", "   "),
      AiRouterError,
    );
  });

  it("accepts object-scoped modes once a page is given", () => {
    assert.doesNotThrow(() => validateContextModeRequirements("current_object", "wald-von-terra"));
  });

  it("leaves modes without a page requirement alone", () => {
    for (const contextMode of ["general_chat", "brain", "personal_brain", "mail"] as const) {
      assert.doesNotThrow(() => validateContextModeRequirements(contextMode));
    }
  });
});

describe("RTX availability guard", () => {
  it("passes when the host is up", () => {
    assert.doesNotThrow(() => validateLocalRtxRequired("personal_brain", true));
  });

  it("throws for every context mode when the host is down", () => {
    for (const contextMode of ALL_CONTEXT_MODES) {
      assert.throws(() => validateLocalRtxRequired(contextMode, false), AiRouterError);
    }
  });
});

describe("legacy context mode mapping", () => {
  it("maps the legacy flags to context modes", () => {
    assert.equal(legacyContextMode({ withBrain: false, generalChat: true }), "general_chat");
    assert.equal(legacyContextMode({ withBrain: true }), "current_object_plus_brain");
    assert.equal(legacyContextMode({ withBrain: false }), "current_object");
  });
});
