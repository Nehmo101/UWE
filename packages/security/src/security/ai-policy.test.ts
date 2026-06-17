import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import type { AiContext } from "@uwe/ai-brain/types";

import {
  assertFetchUrlAllowed,
  isBlockedUserFetchTarget,
  SsrfBlockedError,
} from "./ssrf-guard";
import {
  assertModelAllowed,
  canUseAi,
  enforceAiAccessPolicy,
  enforceAiRequestLimits,
  filterContextForViewer,
  requireAiRole,
  resetAiRateLimit,
  resolveEffectiveAllowDmOnly,
  validatePromptLength,
  AiAccessDeniedError,
  AiPolicyViolationError,
} from "./ai-policy";
import { formatAiPromptLog, redactAiSecrets, sanitizeAiLogPayload } from "./ai-logging";
import { rejectClientWorkerUrl } from "./rtx-boundary";

function emptyContext(overrides: Partial<AiContext> = {}): AiContext {
  return {
    taskType: "summarize_page",
    worldId: "w1",
    primaryPageId: "p1",
    pages: [
      {
        pageId: "p1",
        title: "Geheime Insel",
        pageType: "location",
        visibility: "dm_only",
        canonicalStatus: "draft",
        summary: "DM-only summary",
        tags: [],
        aliases: [],
        contentBlocks: [
          {
            blockId: "b1",
            type: "gm_note",
            content: "Geheimer Plot",
            visibility: "dm_only",
          },
        ],
        relations: [],
        backlinks: [],
      },
    ],
    sources: [],
    promptContext: "Geheimer Plot",
    truncated: false,
    datenschutzMode: false,
    allowDmOnly: true,
    ...overrides,
  };
}

describe("ai-policy — role enforcement", () => {
  it("allows owner, admin, and dm roles", () => {
    assert.equal(canUseAi("owner"), true);
    assert.equal(canUseAi("admin"), true);
    assert.equal(canUseAi("dm"), true);
  });

  it("denies player and guest roles", () => {
    assert.equal(canUseAi("player"), false);
    assert.equal(canUseAi("guest"), false);
  });

  it("blocks player AI usage", () => {
    assert.throws(
      () => requireAiRole({ role: "player" }),
      (error: unknown) => error instanceof AiAccessDeniedError,
    );
  });

  it("allows dm AI usage", () => {
    assert.doesNotThrow(() => requireAiRole({ role: "dm", userKey: "dm-1" }));
  });

  it("treats studio-trusted requests as owner-level", () => {
    assert.doesNotThrow(() =>
      enforceAiAccessPolicy({ role: "guest", studioTrusted: true, userKey: "studio" }),
    );
  });
});

describe("ssrf-guard — fetch allowlist", () => {
  it("blocks localhost and private IP fetches from user input", () => {
    assert.equal(isBlockedUserFetchTarget("http://127.0.0.1:8787/chat"), true);
    assert.equal(isBlockedUserFetchTarget("http://192.168.1.50:11434"), true);
    assert.equal(isBlockedUserFetchTarget("http://localhost:3000"), true);
  });

  it("blocks hosts outside the AI fetch allowlist", () => {
    assert.throws(
      () => assertFetchUrlAllowed("https://evil.example.com/hook"),
      (error: unknown) => error instanceof SsrfBlockedError,
    );
  });
});

describe("ai-policy — request limits", () => {
  const env = {
    AI_MAX_PROMPT_LENGTH: "100",
    AI_MAX_CONTEXT_CHARS: "200",
    AI_MAX_OUTPUT_TOKENS: "512",
    AI_ALLOWED_MODELS: "llama3.2,qwen2.5-coder:7b",
  } as NodeJS.ProcessEnv;

  it("blocks overly long prompts", () => {
    assert.throws(
      () => validatePromptLength("x".repeat(101), env),
      (error: unknown) => error instanceof AiPolicyViolationError,
    );
  });

  it("blocks disallowed models", () => {
    assert.throws(
      () => assertModelAllowed("unknown-model", env),
      (error: unknown) => error instanceof AiPolicyViolationError,
    );
  });

  it("rejects client-provided worker URLs", () => {
    assert.throws(
      () => rejectClientWorkerUrl("http://127.0.0.1:8787"),
      /Worker-URLs dürfen nicht vom Client/,
    );
  });

  it("rejects client-provided worker URLs via enforceAiRequestLimits", () => {
    assert.throws(
      () =>
        enforceAiRequestLimits(
          {
            prompt: "ok",
            workerUrl: "http://192.168.1.50:8787",
          },
          env,
        ),
      /Worker-URLs dürfen nicht vom Client/,
    );
  });
});

describe("ai-policy — DM-only context", () => {
  it("includes DM-only content only when server allows it", () => {
    const allowed = filterContextForViewer(emptyContext(), true, false);
    assert.match(allowed.promptContext, /Geheimer Plot/);

    const denied = filterContextForViewer(emptyContext(), false, false);
    assert.doesNotMatch(denied.promptContext, /Geheimer Plot/);
  });

  it("never trusts client allowDmOnly flag over server policy", () => {
    assert.equal(
      resolveEffectiveAllowDmOnly({
        clientAllowDmOnly: true,
        localOnly: false,
        routeIsCloud: false,
      }),
      false,
    );

    assert.equal(
      resolveEffectiveAllowDmOnly({
        clientAllowDmOnly: true,
        localOnly: true,
        routeIsCloud: false,
      }),
      true,
    );
  });
});

describe("ai-policy — logging redaction", () => {
  it("redacts secrets from logs", () => {
    const input =
      'Authorization: Bearer sk-test-secret-12345 RTX_AGENT_TOKEN=super-secret api_key=abc123';
    const redacted = redactAiSecrets(input);
    assert.doesNotMatch(redacted, /sk-test-secret-12345/);
    assert.doesNotMatch(redacted, /super-secret/);
    assert.match(redacted, /REDACTED/);
  });

  it("does not expose system prompts in sanitized payloads", () => {
    const sanitized = sanitizeAiLogPayload({
      systemPrompt: "secret instructions",
      apiKey: "sk-live",
      prompt: "Hello world",
    });

    assert.equal(sanitized.systemPrompt, undefined);
    assert.equal(sanitized.apiKey, undefined);
    assert.equal(sanitized.prompt, "[prompt logging disabled]");
  });

  it("truncates prompts when logging is enabled", () => {
    const env = {
      AI_LOG_PROMPTS: "true",
      AI_LOG_PROMPT_MAX_CHARS: "10",
    } as NodeJS.ProcessEnv;

    const formatted = formatAiPromptLog("012345678901234567890", env);
    assert.match(formatted, /…/);
    assert.match(formatted, /Zeichen gesamt/);
    assert.ok(!formatted.includes("012345678901234567890"));
  });
});

describe("ai-policy — rate limiting", () => {
  beforeEach(() => {
    resetAiRateLimit("user-a");
  });

  it("rate limits repeated AI calls per user", () => {
    const env = {
      AI_RATE_LIMIT_MAX: "2",
      AI_RATE_LIMIT_WINDOW_MS: "60000",
    } as NodeJS.ProcessEnv;

    enforceAiAccessPolicy({ role: "dm", userKey: "user-a" }, env);
    enforceAiAccessPolicy({ role: "dm", userKey: "user-a" }, env);

    assert.throws(
      () => enforceAiAccessPolicy({ role: "dm", userKey: "user-a" }, env),
      /Rate-Limit/,
    );
  });
});
