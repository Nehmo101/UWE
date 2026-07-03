import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  getRuntimeEnvOverrides,
  setRuntimeEnvOverrides,
  withRuntimeEnvOverrides,
} from "./runtime-env-overrides";
import { getUweRuntimeConfig } from "./runtime-config";
import { getTurnstileConfig } from "./turnstile";

describe("runtime env overrides", () => {
  afterEach(() => setRuntimeEnvOverrides(null));

  it("returns the same env reference when nothing is installed", () => {
    const env = { A: "1" } as unknown as NodeJS.ProcessEnv;
    assert.equal(withRuntimeEnvOverrides(env), env);
    assert.equal(getRuntimeEnvOverrides(), null);
  });

  it("overrides win over the passed env, other keys pass through", () => {
    setRuntimeEnvOverrides({ TRUST_PROXY: "true" });
    const merged = withRuntimeEnvOverrides({
      TRUST_PROXY: "false",
      KEEP: "x",
    } as unknown as NodeJS.ProcessEnv);
    assert.equal(merged.TRUST_PROXY, "true");
    assert.equal(merged.KEEP, "x");
  });

  it("clears back to identity for null or empty records", () => {
    setRuntimeEnvOverrides({ TRUST_PROXY: "true" });
    setRuntimeEnvOverrides(null);
    assert.equal(getRuntimeEnvOverrides(), null);
    setRuntimeEnvOverrides({});
    assert.equal(getRuntimeEnvOverrides(), null);
  });

  it("makes getUweRuntimeConfig observe installed overrides", () => {
    assert.equal(getUweRuntimeConfig({ NODE_ENV: "production" }).authRequired, true);
    setRuntimeEnvOverrides({ AUTH_REQUIRED: "false" });
    assert.equal(getUweRuntimeConfig({ NODE_ENV: "production" }).authRequired, false);
  });

  it("makes getTurnstileConfig observe installed keys", () => {
    assert.equal(getTurnstileConfig({}).enabled, false);
    setRuntimeEnvOverrides({
      TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
      TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
    });
    const cfg = getTurnstileConfig({});
    assert.equal(cfg.enabled, true);
    assert.equal(cfg.siteKey, "1x00000000000000000000AA");
    assert.equal(cfg.secretConfigured, true);
  });

  it("kill-switch off disables Turnstile even when keys exist in env", () => {
    setRuntimeEnvOverrides({ TURNSTILE_ENABLED: "false" });
    const cfg = getTurnstileConfig({
      TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
      TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
    } as unknown as NodeJS.ProcessEnv);
    assert.equal(cfg.enabled, false);
  });
});
