import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { buildLocalHostEnv, deriveOwnedServiceState, desktopHostTargetUrl, parseServicePort, resolveDatabasePath, resolveDesktopHostRoot, type HostPaths } from "./desktop-host";

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
});
