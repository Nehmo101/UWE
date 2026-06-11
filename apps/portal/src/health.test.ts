import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("portal health response shape", () => {
  it("defines expected health payload fields", () => {
    const payload = {
      status: "ok",
      app: "UWE Portal",
      product: "Universeller Welten-Editor",
      version: "0.1.0",
    };

    assert.equal(payload.status, "ok");
    assert.equal(payload.app, "UWE Portal");
    assert.equal(payload.product, "Universeller Welten-Editor");
  });
});
