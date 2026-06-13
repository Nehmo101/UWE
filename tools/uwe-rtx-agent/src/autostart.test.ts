import assert from "node:assert/strict";
import test from "node:test";

import { getAutostartStatus } from "./autostart.js";

test("getAutostartStatus returns disabled on non-Windows platforms", () => {
  if (process.platform === "win32") {
    return;
  }

  const status = getAutostartStatus();
  assert.equal(status.enabled, false);
});
