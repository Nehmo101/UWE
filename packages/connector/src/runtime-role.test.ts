import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isConnectorRole,
  isHostRole,
  resolveConnectorRuntimeConfig,
  resolveRuntimeRole,
} from "./runtime-role";

test("host is the default role", () => {
  assert.equal(resolveRuntimeRole({}), "host");
  assert.equal(isHostRole({}), true);
  assert.equal(isConnectorRole({}), false);
});

test("connector role is opt-in via UWE_RUNTIME_ROLE", () => {
  assert.equal(resolveRuntimeRole({ UWE_RUNTIME_ROLE: "rtx-connector" }), "rtx-connector");
  assert.equal(resolveRuntimeRole({ UWE_RUNTIME_ROLE: "connector" }), "rtx-connector");
  assert.equal(isConnectorRole({ UWE_RUNTIME_ROLE: "rtx-connector" }), true);
  assert.equal(isHostRole({ UWE_RUNTIME_ROLE: "rtx-connector" }), false);
});

test("resolveConnectorRuntimeConfig requires host url and token", () => {
  assert.equal(resolveConnectorRuntimeConfig({}).ok, false);
  assert.equal(resolveConnectorRuntimeConfig({ UWE_HOST_URL: "https://uweanddragons.org" }).ok, false);
  assert.equal(
    resolveConnectorRuntimeConfig({ UWE_HOST_URL: "not a url", UWE_CONNECTOR_TOKEN: "uwec_x" }).ok,
    false,
  );

  const result = resolveConnectorRuntimeConfig({
    UWE_HOST_URL: "https://uweanddragons.org/",
    UWE_CONNECTOR_TOKEN: "uwec_secret",
    UWE_CONNECTOR_NAME: "RTX Laptop",
    UWE_CONNECTOR_CAPABILITIES: "llm_local, audio_local, bogus",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.config.hostUrl, "https://uweanddragons.org");
    assert.equal(result.config.name, "RTX Laptop");
    assert.equal(result.config.queueEnabled, true);
    assert.deepEqual(result.config.forcedCapabilities, ["audio_local", "llm_local"]);
  }
});

test("queue can be disabled via env", () => {
  const result = resolveConnectorRuntimeConfig({
    UWE_HOST_URL: "https://uweanddragons.org",
    UWE_CONNECTOR_TOKEN: "uwec_secret",
    UWE_CONNECTOR_QUEUE_ENABLED: "false",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.config.queueEnabled, false);
  }
});
