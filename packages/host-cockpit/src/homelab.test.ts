import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { probePortalHealth } from "./homelab";

/**
 * `probePortalHealth` is the one piece of the cockpit that talks to the network,
 * so it is the one piece that can fail in ways the caller has to render. The
 * status page shows its message verbatim — these cases pin what it says.
 */

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

function stubFetch(response: Partial<Response> & { json?: () => Promise<unknown> }): void {
  globalThis.fetch = (async () => response as Response) as typeof fetch;
}

describe("probePortalHealth", () => {
  it("reports a missing portal URL instead of guessing one", async () => {
    const result = await probePortalHealth({} as NodeJS.ProcessEnv);
    assert.equal(result.ok, false);
    assert.match(result.message, /NEXT_PUBLIC_PORTAL_URL/);
  });

  it("treats a non-2xx response as unhealthy and names the status", async () => {
    stubFetch({ ok: false, status: 503 });
    const result = await probePortalHealth({
      NEXT_PUBLIC_PORTAL_URL: "http://portal.local",
    } as NodeJS.ProcessEnv);
    assert.equal(result.ok, false);
    assert.match(result.message, /503/);
  });

  it("honours an ok:false payload behind an HTTP 200", async () => {
    stubFetch({ ok: true, status: 200, json: async () => ({ ok: false, message: "DB weg" }) });
    const result = await probePortalHealth({
      NEXT_PUBLIC_PORTAL_URL: "http://portal.local/",
    } as NodeJS.ProcessEnv);
    assert.equal(result.ok, false);
    assert.equal(result.message, "DB weg");
  });

  it("reports a healthy portal", async () => {
    stubFetch({ ok: true, status: 200, json: async () => ({ ok: true }) });
    const result = await probePortalHealth({
      NEXT_PUBLIC_PORTAL_URL: "http://portal.local",
    } as NodeJS.ProcessEnv);
    assert.deepEqual(result, { ok: true, message: "Portal erreichbar" });
  });

  it("turns a network failure into a message rather than throwing", async () => {
    globalThis.fetch = (async () => {
      throw new Error("connect ECONNREFUSED");
    }) as typeof fetch;
    const result = await probePortalHealth({
      NEXT_PUBLIC_PORTAL_URL: "http://portal.local",
    } as NodeJS.ProcessEnv);
    assert.equal(result.ok, false);
    assert.match(result.message, /ECONNREFUSED/);
  });
});
