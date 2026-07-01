import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fetchMaintenanceMiddlewareDecision,
  MAINTENANCE_EVALUATE_API_PATH,
} from "./maintenance-middleware";

describe("maintenance middleware helper", () => {
  it("returns null when maintenance evaluate API reports allowed", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ blocked: false }), { status: 200 });

    try {
      const decision = await fetchMaintenanceMiddlewareDecision(
        "http://studio.test",
        "/today",
        "studio",
        null,
      );
      assert.equal(decision, null);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns blocked decision for locked surfaces", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, MAINTENANCE_EVALUATE_API_PATH);
      assert.equal(url.searchParams.get("pathname"), "/api/worlds");
      assert.equal(url.searchParams.get("surface"), "studio");
      return new Response(
        JSON.stringify({
          blocked: true,
          message: "Studio gesperrt",
          redirectPath: "/maintenance",
        }),
        { status: 200 },
      );
    };

    try {
      const decision = await fetchMaintenanceMiddlewareDecision(
        "http://studio.test",
        "/api/worlds",
        "studio",
        "uwe_session=abc",
      );
      assert.ok(decision);
      assert.equal(decision.blocked, true);
      assert.equal(decision.message, "Studio gesperrt");
      assert.equal(decision.redirectPath, "/maintenance");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
