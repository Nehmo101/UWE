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
  assert.equal(resolveConnectorRuntimeConfig({ UWE_HOST_URL: "https://uwe.example" }).ok, false);
  assert.equal(
    resolveConnectorRuntimeConfig({ UWE_HOST_URL: "not a url", UWE_CONNECTOR_TOKEN: "uwec_x" }).ok,
    false,
  );

  const result = resolveConnectorRuntimeConfig({
    UWE_HOST_URL: "https://uwe.example/",
    UWE_CONNECTOR_TOKEN: "uwec_secret",
    UWE_CONNECTOR_NAME: "RTX Laptop",
    UWE_CONNECTOR_CAPABILITIES: "llm_local, audio_local, bogus",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.config.hostUrl, "https://uwe.example");
    assert.equal(result.config.name, "RTX Laptop");
    assert.equal(result.config.transportMode, "queue");
    assert.equal(result.config.queueEnabled, true);
    assert.deepEqual(result.config.forcedCapabilities, ["audio_local", "llm_local"]);
  }
});

test("legacy queue opt-out stays paused and never enables Direct implicitly", () => {
  const result = resolveConnectorRuntimeConfig({
    UWE_HOST_URL: "https://uwe.example",
    UWE_CONNECTOR_TOKEN: "uwec_secret",
    UWE_CONNECTOR_QUEUE_ENABLED: "false",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.config.transportMode, "queue");
    assert.equal(result.config.queueEnabled, false);
  }
});

test("Direct transport is enabled only by the explicit transport setting", () => {
  const result = resolveConnectorRuntimeConfig({
    UWE_HOST_URL: "https://uwe.example",
    UWE_CONNECTOR_TOKEN: "uwec_secret",
    UWE_CONNECTOR_TRANSPORT: "direct",
    UWE_CONNECTOR_QUEUE_ENABLED: "true",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.config.transportMode, "direct");
    assert.equal(result.config.queueEnabled, false);
  }
});

test("explicit transport wins and derives queue compatibility", () => {
  const result = resolveConnectorRuntimeConfig({
    UWE_HOST_URL: "https://uwe.example",
    UWE_CONNECTOR_TOKEN: "uwec_secret",
    UWE_CONNECTOR_TRANSPORT: " HYBRID ",
    UWE_CONNECTOR_QUEUE_ENABLED: "false",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.config.transportMode, "hybrid");
    assert.equal(result.config.queueEnabled, true);
  }
});

test("invalid explicit transport falls back safely to queue", () => {
  const result = resolveConnectorRuntimeConfig({
    UWE_HOST_URL: "https://uwe.example",
    UWE_CONNECTOR_TOKEN: "uwec_secret",
    UWE_CONNECTOR_TRANSPORT: "websocket",
    UWE_CONNECTOR_QUEUE_ENABLED: "false",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.config.transportMode, "queue");
    assert.equal(result.config.queueEnabled, true);
  }
});

test("Direct and Hybrid require https for non-loopback hosts", () => {
  for (const transport of ["direct", "hybrid"]) {
    assert.equal(
      resolveConnectorRuntimeConfig({
        UWE_HOST_URL: "http://192.168.1.20:3000",
        UWE_CONNECTOR_TOKEN: "uwec_secret",
        UWE_CONNECTOR_TRANSPORT: transport,
      }).ok,
      false,
    );
    assert.equal(
      resolveConnectorRuntimeConfig({
        UWE_HOST_URL: "https://uwe.example",
        UWE_CONNECTOR_TOKEN: "uwec_secret",
        UWE_CONNECTOR_TRANSPORT: transport,
      }).ok,
      true,
    );
  }
});

test("Direct permits explicit loopback http hosts", () => {
  for (const host of ["http://localhost:3000", "http://127.0.0.1:3000", "http://[::1]:3000"]) {
    assert.equal(
      resolveConnectorRuntimeConfig({
        UWE_HOST_URL: host,
        UWE_CONNECTOR_TOKEN: "uwec_secret",
        UWE_CONNECTOR_TRANSPORT: "direct",
      }).ok,
      true,
    );
  }
});

test("queue-only legacy config also rejects remote plaintext http", () => {
  const result = resolveConnectorRuntimeConfig({
    UWE_HOST_URL: "http://192.168.1.20:3000",
    UWE_CONNECTOR_TOKEN: "uwec_secret",
    UWE_CONNECTOR_QUEUE_ENABLED: "false",
  });
  assert.equal(result.ok, false);
});
