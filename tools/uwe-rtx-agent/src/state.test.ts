import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { redactSecrets } from "./logging.js";
import { loadPersistedState, savePersistedState, setPersistedEnabled } from "./state.js";

test("redactSecrets hides tokens and prompt content", () => {
  const input =
    'AGENT_TOKEN=super-secret authorization: Bearer abc123 "content":"hello world"';
  const output = redactSecrets(input);
  assert.match(output, /AGENT_TOKEN=\*\*\*REDACTED\*\*\*/);
  assert.match(output, /Bearer \*\*\*REDACTED\*\*\*/);
  assert.doesNotMatch(output, /super-secret/);
  assert.doesNotMatch(output, /hello world/);
});

test("persisted enabled state survives reload", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-rtx-agent-test-"));
  const previousLocalAppData = process.env.LOCALAPPDATA;
  process.env.LOCALAPPDATA = tempDir;

  try {
    setPersistedEnabled(false);
    assert.equal(loadPersistedState().enabled, false);
    setPersistedEnabled(true);
    assert.equal(loadPersistedState().enabled, true);

    savePersistedState({ enabled: false, lastHealthCheckAt: "2026-06-13T10:00:00.000Z" });
    const reloaded = loadPersistedState();
    assert.equal(reloaded.enabled, false);
    assert.equal(reloaded.lastHealthCheckAt, "2026-06-13T10:00:00.000Z");
  } finally {
    if (previousLocalAppData === undefined) {
      delete process.env.LOCALAPPDATA;
    } else {
      process.env.LOCALAPPDATA = previousLocalAppData;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
