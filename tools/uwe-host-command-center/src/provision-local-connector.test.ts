import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

import { provisionLocalConnector, type LocalConnectorService } from "./provision-local-connector";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function temporaryHost(): { root: string; dataRoot: string; configPath: string } {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-local-connector-"));
  temporaryDirectories.push(directory);
  return {
    root: path.join(directory, "repo"),
    dataRoot: path.join(directory, "client", "host"),
    configPath: path.join(directory, "client", "config.json"),
  };
}

function fakeService(validToken?: string): LocalConnectorService {
  return {
    authenticate: async (token) => token === validToken ? { id: "existing", name: "Existing local connector" } : null,
    listConnectors: async () => [],
    createConnector: async (name) => ({ connector: { id: "created", name }, token: "uwec_local" }),
    rotateToken: async () => ({ token: "uwec_rotated" }),
  };
}

test("provisions a local connector while preserving unrelated settings and remote config", async () => {
  const host = temporaryHost();
  fs.mkdirSync(path.dirname(host.configPath), { recursive: true });
  fs.writeFileSync(host.configPath, JSON.stringify({
    hostUrl: "https://studio.example.test",
    token: "uwec_remote",
    spotifyClientId: "spotify-kept",
  }), "utf8");

  const result = await provisionLocalConnector({ ...host, hostUrl: "http://127.0.0.1:3100", service: fakeService() });
  const saved = JSON.parse(fs.readFileSync(host.configPath, "utf8")) as Record<string, unknown>;

  assert.equal(result.reusedToken, false);
  assert.equal(result.backupCreated, true);
  assert.equal(saved.hostUrl, "http://127.0.0.1:3100");
  assert.equal(saved.token, "uwec_local");
  assert.equal(saved.spotifyClientId, "spotify-kept");
  assert.equal(saved.localHostRoot, path.resolve(host.root));
  assert.equal(fs.existsSync(path.join(path.dirname(host.dataRoot), "config.remote-before-local.json")), true);
});

test("keeps an already valid local token", async () => {
  const host = temporaryHost();
  fs.mkdirSync(path.dirname(host.configPath), { recursive: true });
  fs.writeFileSync(host.configPath, JSON.stringify({
    hostUrl: "http://127.0.0.1:3000",
    token: "uwec_valid",
  }), "utf8");

  const result = await provisionLocalConnector({ ...host, service: fakeService("uwec_valid") });
  const saved = JSON.parse(fs.readFileSync(host.configPath, "utf8")) as Record<string, unknown>;

  assert.equal(result.reusedToken, true);
  assert.equal(result.backupCreated, false);
  assert.equal(saved.token, "uwec_valid");
});
