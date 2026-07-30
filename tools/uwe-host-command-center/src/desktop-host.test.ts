import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { buildLocalHostEnv, deriveOwnedServiceState, desktopHostTargetUrl, isOwnServiceApp, parseServicePort, resolveDatabasePath, resolveDesktopHostRoot, type HostPaths } from "./desktop-host";
import { healthAppName, parseNetstatListeners } from "./desktop-host-system";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function temporaryDirectory(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-command-center-"));
  temporaryDirectories.push(directory);
  return directory;
}

function hostPaths(root: string): HostPaths {
  const dataRoot = path.join(root, "state");
  return {
    root,
    dataRoot,
    data: path.join(dataRoot, "data"),
    uploads: path.join(dataRoot, "data", "uploads"),
    backups: path.join(dataRoot, "data", "backups"),
    exports: path.join(dataRoot, "exports"),
    logs: path.join(dataRoot, "logs"),
    runtime: path.join(dataRoot, "runtime"),
    envFile: path.join(root, ".env"),
    database: path.join(dataRoot, "data", "uwe.db"),
  };
}

describe("desktop host configuration", () => {
  it("creates secure, loopback-only defaults with persistent data paths", () => {
    const env = buildLocalHostEnv(hostPaths(temporaryDirectory()));

    assert.match(env, /AUTH_REQUIRED=true/);
    assert.match(env, /SESSION_COOKIE_SECURE=false/);
    assert.match(env, /PUBLIC_BASE_URL=http:\/\/127\.0\.0\.1:3000/);
    assert.match(env, /TRUST_PROXY=false/);
    assert.match(env, /CLOUDFLARE_TUNNEL=false/);
    assert.match(env, /AI_INFERENCE_BASE_URL=http:\/\/127\.0\.0\.1:11434/);
    assert.match(env, /UWE_AI_CLOUD_FALLBACK=false/);
    assert.doesNotMatch(env, /generate-a-random-secret/);
    assert.match(env, /SESSION_SECRET=[A-Za-z0-9_-]{40,}/);
  });

  it("resolves relative Prisma file URLs from the database package", () => {
    const root = temporaryDirectory();
    const envFile = path.join(root, ".env");
    fs.writeFileSync(envFile, "DATABASE_URL=file:./data/uwe.db\n", "utf8");

    assert.equal(
      resolveDatabasePath(root, envFile, "fallback.db"),
      path.resolve(root, "packages", "database", "./data/uwe.db"),
    );
  });

  it("opens Studio and Portal on their configured ports", () => {
    const root = temporaryDirectory();
    fs.writeFileSync(path.join(root, ".env"), "STUDIO_PORT=3100\nPORTAL_PORT=3101\n", "utf8");

    assert.equal(desktopHostTargetUrl(root, "studio"), "http://127.0.0.1:3100");
    assert.equal(desktopHostTargetUrl(root, "portal"), "http://127.0.0.1:3101");
  });

  it("finds a UWE workspace by walking up from a nested directory", () => {
    const root = temporaryDirectory();
    fs.mkdirSync(path.join(root, "apps", "studio"), { recursive: true });
    fs.mkdirSync(path.join(root, "apps", "portal"), { recursive: true });
    fs.writeFileSync(path.join(root, "pnpm-workspace.yaml"), "packages: []\n", "utf8");
    const previousConfiguredRoot = process.env.UWE_MONOREPO_ROOT;
    delete process.env.UWE_MONOREPO_ROOT;
    const previous = process.cwd();
    process.chdir(path.join(root, "apps", "studio"));
    try {
      assert.equal(resolveDesktopHostRoot(), root);
    } finally {
      process.chdir(previous);
      if (previousConfiguredRoot === undefined) {
        delete process.env.UWE_MONOREPO_ROOT;
      } else {
        process.env.UWE_MONOREPO_ROOT = previousConfiguredRoot;
      }
    }
  });
});

describe("desktop host service ownership", () => {
  it("distinguishes owned services from foreign port listeners", () => {
    assert.deepEqual(deriveOwnedServiceState(false, true, false), {
      state: "error",
      healthy: false,
      message: "Port ist durch einen fremd gestarteten Dienst belegt.",
    });
    assert.equal(deriveOwnedServiceState(true, true, true).state, "online");
    assert.equal(deriveOwnedServiceState(true, true, false).state, "error");
    assert.equal(deriveOwnedServiceState(true, false, false).state, "starting");
    assert.equal(deriveOwnedServiceState(false, false, false).state, "stopped");
    assert.equal(parseServicePort("3100", 3000), 3100);
    assert.equal(parseServicePort("70000", 3000), 3000);
    assert.equal(parseServicePort("invalid", 3000), 3000);
  });

  it("recognises an own orphaned service by its health self-report", () => {
    assert.equal(isOwnServiceApp("landing", "UWE Landing"), true);
    assert.equal(isOwnServiceApp("studio", "UWE Studio"), true);
    // Fremder Dienst, unlesbare Antwort oder die falsche UWE-App: nie anfassen.
    assert.equal(isOwnServiceApp("landing", "UWE Studio"), false);
    assert.equal(isOwnServiceApp("landing", "Grafana"), false);
    assert.equal(isOwnServiceApp("landing", null), false);
  });

  it("reads the app name from both health payload shapes", () => {
    assert.equal(healthAppName({ status: "ok", app: "UWE Landing" }), "UWE Landing");
    assert.equal(healthAppName({ status: "ok", app: { name: "UWE Studio", version: "1.2.3" } }), "UWE Studio");
    assert.equal(healthAppName({ status: "ok" }), null);
    assert.equal(healthAppName({ app: { version: "1.2.3" } }), null);
    assert.equal(healthAppName("ok"), null);
    assert.equal(healthAppName(null), null);
  });
});

describe("desktop host port listeners", () => {
  // Lokalisiertes `netstat -ano` (deutsches Windows): der Status taugt nicht als
  // Filter, die TIME_WAIT-Leichen mit PID 0 dürfen nicht als Belegung zählen.
  const NETSTAT = [
    "",
    "Aktive Verbindungen",
    "",
    "  Proto  Lokale Adresse         Remoteadresse          Status           PID",
    "  TCP    127.0.0.1:3103         0.0.0.0:0              ABHÖREN         11820",
    "  TCP    127.0.0.1:56660        127.0.0.1:3103         WARTEND         0",
    "  TCP    127.0.0.1:13103        0.0.0.0:0              ABHÖREN         7777",
    "  TCP    127.0.0.1:3100         0.0.0.0:0              ABHÖREN         2222",
    "  TCP    [::]:3103              [::]:0                 ABHÖREN         4680",
    "  UDP    0.0.0.0:5353           *:*                                    1500",
  ].join("\r\n");

  it("finds every listener on the port, ignoring TIME_WAIT, UDP and lookalike ports", () => {
    assert.deepEqual(parseNetstatListeners(NETSTAT, 3103), [11820, 4680]);
    assert.deepEqual(parseNetstatListeners(NETSTAT, 3100), [2222]);
    assert.deepEqual(parseNetstatListeners(NETSTAT, 3101), []);
  });
});
