import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, it } from "node:test";
import {
  createHostCommandCenterServer,
  isAllowedControlOrigin,
  isAllowedHostHeader,
} from "./server";

describe("host command center server", () => {
  let server: ReturnType<typeof createHostCommandCenterServer>;
  let baseUrl = "";

  before(async () => {
    server = createHostCommandCenterServer({ host: "127.0.0.1", port: 0, baseDir: "/opt/uwe" });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address === "object");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("serves the dashboard HTML with a server-injected control token", async () => {
    const response = await fetch(`${baseUrl}/`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /UWE Host Command Center/);
    assert.match(html, /Update UWE/);
    assert.match(html, /Update-Fortschritt/);
    // The placeholder must be replaced with a real token, and never left verbatim.
    assert.doesNotMatch(html, /__UWE_HCC_CONTROL_TOKEN__/);
    const tokenMatch = html.match(/name="uwe-hcc-control-token" content="([^"]+)"/);
    assert.ok(tokenMatch && tokenMatch[1].length > 0, "expected an injected control token");
  });

  it("returns a host snapshot JSON", async () => {
    const response = await fetch(`${baseUrl}/api/snapshot`);
    assert.ok([200, 503].includes(response.status));
    const body = (await response.json()) as {
      collectedAt?: string;
      overall?: string;
      uwe?: { studio?: { label?: string } };
      control?: { actions?: unknown[] };
      hostUpdate?: { progressPercent?: number; state?: { status?: string } };
    };
    assert.ok(body.collectedAt);
    assert.ok(body.overall);
    assert.ok(body.uwe?.studio?.label);
    assert.ok(Array.isArray(body.control?.actions));
    assert.ok(body.hostUpdate);
    assert.ok(typeof body.hostUpdate?.progressPercent === "number");
  });

  it("exposes host update progress", async () => {
    const response = await fetch(`${baseUrl}/api/host-update`);
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      active?: boolean;
      progressPercent?: number;
      phaseLabel?: string;
      state?: { status?: string };
      logLines?: unknown[];
    };
    assert.ok(typeof body.progressPercent === "number");
    assert.ok(body.phaseLabel);
    assert.ok(body.state?.status);
    assert.ok(Array.isArray(body.logLines));
  });

  it("exposes control bootstrap metadata without leaking the token", async () => {
    const response = await fetch(`${baseUrl}/api/control/bootstrap`);
    assert.equal(response.status, 200);
    const body = (await response.json()) as { token?: string; actions?: unknown[] };
    assert.equal(body.token, undefined, "bootstrap must not vend the control token");
    assert.ok(Array.isArray(body.actions));
  });

  it("rejects requests with a non-loopback Host header (DNS-rebinding defense)", async () => {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const status = await new Promise<number>((resolve, reject) => {
      const req = http.request(
        { host: "127.0.0.1", port: address.port, path: "/api/snapshot", method: "GET", headers: { host: "evil.example.com" } },
        (res) => {
          res.resume();
          resolve(res.statusCode ?? 0);
        },
      );
      req.on("error", reject);
      req.end();
    });
    assert.equal(status, 403);
  });

  it("reports health", async () => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    const body = (await response.json()) as { ok?: boolean };
    assert.equal(body.ok, true);
  });

  it("validates host headers and control origins", () => {
    assert.equal(isAllowedHostHeader("127.0.0.1:3099"), true);
    assert.equal(isAllowedHostHeader("localhost:3099"), true);
    assert.equal(isAllowedHostHeader("[::1]:3099"), true);
    assert.equal(isAllowedHostHeader("127.0.0.1"), true);
    assert.equal(isAllowedHostHeader("127.0.0.1:54321"), true);
    assert.equal(isAllowedHostHeader("evil.example.com"), false);
    assert.equal(isAllowedHostHeader("evil.example.com:3099"), false);
    assert.equal(isAllowedHostHeader(undefined), false);

    const originOf = (headers: Record<string, string>) =>
      isAllowedControlOrigin({ headers } as unknown as http.IncomingMessage);
    assert.equal(originOf({}), true);
    assert.equal(originOf({ origin: "http://127.0.0.1:3099" }), true);
    assert.equal(originOf({ origin: "https://evil.example.com" }), false);
    assert.equal(originOf({ "sec-fetch-site": "cross-site" }), false);
    assert.equal(originOf({ "sec-fetch-site": "same-origin" }), true);
  });
});
