import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const PROXY_SCRIPT = path.join(REPO_ROOT, "deploy", "scripts", "uwe-dav-proxy.mjs");

// Stub-Kind: HTTP-Server auf process.env.PORT, antwortet mit Methode, URL und
// dem (ggf. übersetzten) DAV-Header als JSON. GET /die beendet den Prozess.
const STUB_CHILD = `
  const http = require("node:http");
  http
    .createServer((req, res) => {
      if (req.url === "/die") {
        res.end("bye");
        setTimeout(() => process.exit(0), 20);
        return;
      }
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          method: req.method,
          url: req.url,
          davHeader: req.headers["x-uwe-dav-method"] ?? null,
        }),
      );
    })
    .listen(Number(process.env.PORT), "127.0.0.1");
`;

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address && typeof address === "object") {
        const port = address.port;
        server.close(() => resolve(port));
      } else {
        server.close(() => reject(new Error("Kein Port zugewiesen.")));
      }
    });
  });
}

async function waitForProxy(port: number): Promise<void> {
  // Erst wenn eine 2xx-Antwort kommt, sind Proxy UND Stub-Kind erreichbar —
  // eine 502 heisst nur, dass der Proxy lauscht, das Kind aber noch bootet.
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/ping`);
      if (response.ok) return;
    } catch {
      // Proxy lauscht noch nicht.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Proxy oder Stub-Kind wurde nicht erreichbar.");
}

describe("uwe-dav-proxy", () => {
  let proxy: ChildProcess;
  let listenPort: number;
  let proxyExit: Promise<number | null>;

  before(async () => {
    listenPort = await freePort();
    const upstreamPort = await freePort();
    proxy = spawn(
      process.execPath,
      [
        PROXY_SCRIPT,
        "--listen",
        String(listenPort),
        "--upstream",
        String(upstreamPort),
        "--host",
        "127.0.0.1",
        "--",
        process.execPath,
        "-e",
        STUB_CHILD,
      ],
      { stdio: ["ignore", "ignore", "inherit"] },
    );
    proxyExit = new Promise((resolve) => proxy.on("exit", (code) => resolve(code)));
    await waitForProxy(listenPort);
  });

  after(() => {
    if (proxy.exitCode === null) proxy.kill("SIGKILL");
  });

  it("übersetzt PROPFIND auf DAV-Pfaden in POST + x-uwe-dav-method", async () => {
    const response = await fetch(`http://127.0.0.1:${listenPort}/api/dav/cal/familie/`, {
      method: "PROPFIND",
      headers: { depth: "0" },
    });
    const body = (await response.json()) as { method: string; url: string; davHeader: string | null };
    assert.equal(body.method, "POST");
    assert.equal(body.davHeader, "PROPFIND");
    // Trailing Slash wird entfernt, damit Next nicht mit 308 umleitet.
    assert.equal(body.url, "/api/dav/cal/familie");
  });

  it("übersetzt PROPFIND auch für /.well-known/caldav", async () => {
    const response = await fetch(`http://127.0.0.1:${listenPort}/.well-known/caldav`, {
      method: "PROPFIND",
    });
    const body = (await response.json()) as { method: string; davHeader: string | null };
    assert.equal(body.method, "POST");
    assert.equal(body.davHeader, "PROPFIND");
  });

  it("lässt DAV-Methoden auf fremden Pfaden unübersetzt durch", async () => {
    const response = await fetch(`http://127.0.0.1:${listenPort}/calendar`, {
      method: "PROPFIND",
    });
    const body = (await response.json()) as { method: string; davHeader: string | null };
    assert.equal(body.method, "PROPFIND");
    assert.equal(body.davHeader, null);
  });

  it("strippt einen gespooften x-uwe-dav-method-Header", async () => {
    const response = await fetch(`http://127.0.0.1:${listenPort}/api/dav/cal/familie/`, {
      method: "POST",
      headers: { "x-uwe-dav-method": "PROPFIND" },
    });
    const body = (await response.json()) as { method: string; davHeader: string | null };
    assert.equal(body.method, "POST");
    assert.equal(body.davHeader, null);
  });

  it("reicht normale Requests samt Query verbatim durch", async () => {
    const response = await fetch(`http://127.0.0.1:${listenPort}/api/health?probe=1`);
    const body = (await response.json()) as { method: string; url: string };
    assert.equal(body.method, "GET");
    assert.equal(body.url, "/api/health?probe=1");
  });

  it("beendet sich, wenn der Kindprozess stirbt", async () => {
    await fetch(`http://127.0.0.1:${listenPort}/die`);
    const code = await proxyExit;
    assert.equal(code, 1);
  });
});
