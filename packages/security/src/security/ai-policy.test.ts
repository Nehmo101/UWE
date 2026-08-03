import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import {
  assertFetchUrlAllowed,
  assertUserProvidedFetchUrlAllowed,
  isBlockedUserFetchTarget,
  SsrfBlockedError,
} from "./ssrf-guard";
import {
  assertModelAllowed,
  canUseAi,
  enforceAiAccessPolicy,
  enforceAiRequestLimits,
  requireAiRole,
  resetAiRateLimit,
  validatePromptLength,
  AiAccessDeniedError,
  AiPolicyViolationError,
} from "./ai-policy";
import { formatAiPromptLog, redactAiSecrets, sanitizeAiLogPayload } from "./ai-logging";
import { rejectClientWorkerUrl } from "./engine-boundary";


describe("ai-policy — access enforcement", () => {
  it("allows the Studio checkbox", () => {
    assert.equal(canUseAi({ studioAccess: true }), true);
  });

  it("denies everyone without it", () => {
    assert.equal(canUseAi({ studioAccess: false }), false);
  });

  it("blocks AI usage without Studio access", () => {
    assert.throws(
      () => requireAiRole({ studioAccess: false }),
      (error: unknown) => error instanceof AiAccessDeniedError,
    );
  });

  it("allows AI usage with Studio access", () => {
    assert.doesNotThrow(() => requireAiRole({ studioAccess: true, userKey: "dm-1" }));
  });

  it("treats studio-trusted requests as owner-level", () => {
    assert.doesNotThrow(() =>
      enforceAiAccessPolicy({ studioAccess: false, studioTrusted: true, userKey: "studio" }),
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

  it("allows public hosts for user-provided feed URLs", () => {
    assert.doesNotThrow(() =>
      assertUserProvidedFetchUrlAllowed("https://calendar.google.com/public/ical.ics"),
    );
  });

  it("blocks private hosts for user-provided feed URLs", () => {
    assert.throws(
      () => assertUserProvidedFetchUrlAllowed("http://127.0.0.1:8080/feed.ics"),
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

describe("ai-policy — logging redaction", () => {
  it("redacts secrets from logs", () => {
    const input =
      'Authorization: Bearer sk-test-secret-12345 ENGINE_AGENT_TOKEN=super-secret api_key=abc123';
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

    enforceAiAccessPolicy({ studioAccess: true, userKey: "user-a" }, env);
    enforceAiAccessPolicy({ studioAccess: true, userKey: "user-a" }, env);

    assert.throws(
      () => enforceAiAccessPolicy({ studioAccess: true, userKey: "user-a" }, env),
      /Rate-Limit/,
    );
  });
});
