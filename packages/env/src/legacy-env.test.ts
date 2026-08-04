import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { warnAboutLegacyRtxEnvVars } from "./legacy-env";

describe("warnAboutLegacyRtxEnvVars", () => {
  it("warnt laut und nennt die Umbenennung, wenn RTX_* gesetzt ist", () => {
    const messages: string[] = [];
    const found = warnAboutLegacyRtxEnvVars(
      { RTX_BASE_URL: "http://x", RTX_SERVICE_TOKEN: "t", ENGINE_TIMEOUT_MS: "5" },
      (message) => messages.push(message),
    );

    assert.deepEqual(found, ["RTX_BASE_URL", "RTX_SERVICE_TOKEN"]);
    assert.equal(messages.length, 1);
    assert.match(messages[0]!, /IGNORIERT/);
    assert.match(messages[0]!, /RTX_BASE_URL {2}→ {2}ENGINE_BASE_URL/);
    assert.match(messages[0]!, /engine-rename-migration\.md/);
  });

  it("bleibt still, wenn nichts Altes gesetzt ist", () => {
    const messages: string[] = [];
    const found = warnAboutLegacyRtxEnvVars(
      { ENGINE_BASE_URL: "http://x" },
      (message) => messages.push(message),
    );

    assert.deepEqual(found, []);
    assert.deepEqual(messages, []);
  });
});
