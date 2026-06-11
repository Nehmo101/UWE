import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { UWE_PRODUCT_NAME, UWE_VERSION } from "@uwe/database/server";

describe("studio health response shape", () => {
  it("defines expected health payload fields", () => {
    const payload = {
      status: "ok",
      app: "UWE Studio",
      product: UWE_PRODUCT_NAME,
      version: UWE_VERSION,
    };

    assert.equal(payload.status, "ok");
    assert.equal(payload.app, "UWE Studio");
    assert.equal(payload.product, "Universeller Welten-Editor");
    assert.match(payload.version, /^\d+\.\d+\.\d+$/);
  });
});
