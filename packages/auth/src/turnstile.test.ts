import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  TURNSTILE_VERIFY_ENDPOINT,
  getTurnstileConfig,
  isTurnstileEnabled,
  verifyTurnstileToken,
} from "./turnstile";

const SITE_KEY = "1x00000000000000000000AA";
const SECRET_KEY = "1x0000000000000000000000000000000AA";

describe("turnstile config", () => {
  it("is disabled with no keys", () => {
    const config = getTurnstileConfig({});
    assert.equal(config.enabled, false);
    assert.equal(config.siteKey, null);
    assert.equal(config.secretConfigured, false);
  });

  it("is enabled when both site and secret key are present", () => {
    const config = getTurnstileConfig({
      TURNSTILE_SITE_KEY: SITE_KEY,
      TURNSTILE_SECRET_KEY: SECRET_KEY,
    });
    assert.equal(config.enabled, true);
    assert.equal(config.siteKey, SITE_KEY);
    assert.equal(config.secretConfigured, true);
  });

  it("stays disabled when only one key is set", () => {
    assert.equal(isTurnstileEnabled({ TURNSTILE_SITE_KEY: SITE_KEY }), false);
    assert.equal(isTurnstileEnabled({ TURNSTILE_SECRET_KEY: SECRET_KEY }), false);
  });

  it("honors the TURNSTILE_ENABLED kill-switch even with keys present", () => {
    const env = {
      TURNSTILE_SITE_KEY: SITE_KEY,
      TURNSTILE_SECRET_KEY: SECRET_KEY,
      TURNSTILE_ENABLED: "false",
    };
    assert.equal(isTurnstileEnabled(env), false);
    // The public site key is still resolved so the UI can decide what to render.
    assert.equal(getTurnstileConfig(env).siteKey, SITE_KEY);
  });

  it("never exposes the secret key in the config object", () => {
    const config = getTurnstileConfig({
      TURNSTILE_SITE_KEY: SITE_KEY,
      TURNSTILE_SECRET_KEY: SECRET_KEY,
    });
    assert.equal(JSON.stringify(config).includes(SECRET_KEY), false);
  });
});

describe("turnstile verification", () => {
  const enabledEnv = {
    TURNSTILE_SITE_KEY: SITE_KEY,
    TURNSTILE_SECRET_KEY: SECRET_KEY,
  };

  it("skips (passes) when disabled and never calls the network", async () => {
    let called = false;
    const result = await verifyTurnstileToken("anything", {
      env: {},
      fetchImpl: (async () => {
        called = true;
        return new Response("{}");
      }) as typeof fetch,
    });
    assert.equal(result.success, true);
    assert.equal(result.skipped, true);
    assert.equal(called, false);
  });

  it("fails closed when enabled but no token provided", async () => {
    let called = false;
    const result = await verifyTurnstileToken("", {
      env: enabledEnv,
      fetchImpl: (async () => {
        called = true;
        return new Response("{}");
      }) as typeof fetch,
    });
    assert.equal(result.success, false);
    assert.deepEqual(result.errorCodes, ["missing-input-response"]);
    assert.equal(called, false);
  });

  it("posts secret + token form-encoded and returns success", async () => {
    let capturedUrl: string | undefined;
    let capturedBody: string | undefined;
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedBody = init?.body as string;
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const result = await verifyTurnstileToken("good-token", {
      env: enabledEnv,
      remoteIp: "203.0.113.5",
      fetchImpl,
    });

    assert.equal(result.success, true);
    assert.equal(result.skipped, false);
    assert.equal(capturedUrl, TURNSTILE_VERIFY_ENDPOINT);
    const params = new URLSearchParams(capturedBody);
    assert.equal(params.get("secret"), SECRET_KEY);
    assert.equal(params.get("response"), "good-token");
    assert.equal(params.get("remoteip"), "203.0.113.5");
  });

  it("returns failure with Cloudflare error-codes", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ success: false, "error-codes": ["invalid-input-response"] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as unknown as typeof fetch;

    const result = await verifyTurnstileToken("bad-token", { env: enabledEnv, fetchImpl });
    assert.equal(result.success, false);
    assert.deepEqual(result.errorCodes, ["invalid-input-response"]);
  });

  it("fails closed on network errors", async () => {
    const fetchImpl = (async () => {
      throw new Error("boom");
    }) as unknown as typeof fetch;

    const result = await verifyTurnstileToken("token", { env: enabledEnv, fetchImpl });
    assert.equal(result.success, false);
    assert.deepEqual(result.errorCodes, ["network-error"]);
  });

  it("fails closed on a non-2xx siteverify response", async () => {
    const fetchImpl = (async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    const result = await verifyTurnstileToken("token", { env: enabledEnv, fetchImpl });
    assert.equal(result.success, false);
    assert.deepEqual(result.errorCodes, ["http-500"]);
  });
});
