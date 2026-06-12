import assert from "node:assert/strict";
import net from "node:net";
import { describe, it } from "node:test";

import { checkPorts, isPortAvailable, isPublicHost, isValidPort } from "./ports.js";

describe("ports", () => {
  it("validates port numbers", () => {
    assert.equal(isValidPort(3000), true);
    assert.equal(isValidPort(0), false);
    assert.equal(isValidPort(70000), false);
  });

  it("detects public hosts", () => {
    assert.equal(isPublicHost("0.0.0.0"), true);
    assert.equal(isPublicHost("127.0.0.1"), false);
    assert.equal(isPublicHost("localhost"), false);
  });

  it("reports busy ports when a server is listening", async () => {
    const server = net.createServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("expected server address");
    }

    const available = await isPortAvailable(address.port, "127.0.0.1");
    assert.equal(available, false);

    const result = await checkPorts(address.port, address.port + 1, "127.0.0.1");
    assert.equal(result.ok, false);
    assert.ok(result.busy.includes(address.port));

    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });
});
