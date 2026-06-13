import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { sanitizeEnvForExport } from "./diagnostics.js";

describe("diagnostics", () => {
  it("sanitizes env files without secrets", () => {
    const envFile = path.join(os.tmpdir(), `uwe-env-${process.pid}`);
    fs.writeFileSync(envFile, "AUTH_SECRET=real-secret\nSTUDIO_PORT=3000\n", "utf8");

    const output = sanitizeEnvForExport(envFile);
    assert.match(output, /AUTH_SECRET=\*\*\*REDACTED\*\*\*/);
    assert.match(output, /STUDIO_PORT=3000/);
    assert.doesNotMatch(output, /real-secret/);

    fs.unlinkSync(envFile);
  });
});
