import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createHostCommandCenterServer } from "./server";

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

  it("serves the dashboard HTML", async () => {
    const response = await fetch(`${baseUrl}/`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /UWE Host Command Center/);
    assert.match(html, /Update UWE/);
    assert.match(html, /Update-Fortschritt/);
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

  it("exposes control bootstrap", async () => {
    const response = await fetch(`${baseUrl}/api/control/bootstrap`);
    assert.equal(response.status, 200);
    const body = (await response.json()) as { token?: string; actions?: unknown[] };
    assert.ok(body.token);
    assert.ok(Array.isArray(body.actions));
  });

  it("reports health", async () => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    const body = (await response.json()) as { ok?: boolean };
    assert.equal(body.ok, true);
  });
});
