import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("studio health response shape", () => {
  it("defines expected health payload fields", () => {
    const payload = {
      status: "ok",
      app: "UWE Studio",
      product: "Universeller Welten-Editor",
      version: "0.1.0",
    };

    assert.equal(payload.status, "ok");
    assert.equal(payload.app, "UWE Studio");
    assert.equal(payload.product, "Universeller Welten-Editor");
  });
});
