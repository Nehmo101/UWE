import assert from "node:assert/strict";
import { test } from "node:test";

import { discoverLocalLlms, resolveDiscoveryConfig } from "./llm-discovery";

test("resolveDiscoveryConfig defaults to localhost providers", () => {
  const config = resolveDiscoveryConfig({});
  assert.equal(config.ollamaUrl, "http://127.0.0.1:11434");
  assert.equal(config.lmStudioUrl, "http://127.0.0.1:1234");
});

test("discoverLocalLlms reports providers as unavailable when offline", async () => {
  // Point at ports that are virtually guaranteed to be closed.
  const summary = await discoverLocalLlms({
    ollamaUrl: "http://127.0.0.1:9",
    lmStudioUrl: "http://127.0.0.1:9",
    timeoutMs: 500,
  });
  assert.equal(summary.models.length, 0);
  assert.equal(summary.hasChat, false);
  assert.equal(summary.hasEmbeddings, false);
  for (const provider of summary.providers) {
    assert.notEqual(provider.status, "ready");
  }
});
