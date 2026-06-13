import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { redactSecrets } from "./logging.js";

describe("logging", () => {
  it("redacts secret env values", () => {
    const input = "AUTH_SECRET=my-secret-token\nSTUDIO_PORT=3000\n";
    const output = redactSecrets(input);
    assert.match(output, /AUTH_SECRET=\*\*\*REDACTED\*\*\*/);
    assert.match(output, /STUDIO_PORT=3000/);
    assert.doesNotMatch(output, /my-secret-token/);
  });
});
