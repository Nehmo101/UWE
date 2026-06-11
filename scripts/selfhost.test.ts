import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "..");

describe("self-hosting setup", () => {
  it("includes Docker and compose files", () => {
    assert.ok(fs.existsSync(path.join(root, "Dockerfile")));
    assert.ok(fs.existsSync(path.join(root, "docker-compose.yml")));
    assert.ok(fs.existsSync(path.join(root, ".env.example")));
    assert.ok(fs.existsSync(path.join(root, "VERSION")));
    assert.ok(fs.existsSync(path.join(root, "scripts/docker-entrypoint.sh")));
  });

  it("defines studio and portal services with health checks", () => {
    const compose = fs.readFileSync(path.join(root, "docker-compose.yml"), "utf8");
    assert.match(compose, /studio:/);
    assert.match(compose, /portal:/);
    assert.match(compose, /healthcheck:/);
    assert.match(compose, /uwe-database:/);
    assert.match(compose, /uploads/);
    assert.match(compose, /backups/);
    assert.match(compose, /exports/);
    assert.match(compose, /RUN_DB_SEED.*auto/);
  });

  it("includes persistent data directories", () => {
    assert.ok(fs.existsSync(path.join(root, "data/uploads/.gitkeep")));
    assert.ok(fs.existsSync(path.join(root, "data/backups/.gitkeep")));
    assert.ok(fs.existsSync(path.join(root, "exports/.gitkeep")));
  });

  it("documents auto seed in env example", () => {
    const envExample = fs.readFileSync(path.join(root, ".env.example"), "utf8");
    assert.match(envExample, /RUN_DB_SEED=auto/);
  });

  it("validates docker compose configuration when Docker is available", () => {
    try {
      execSync("docker compose version", { stdio: "pipe" });
    } catch {
      return;
    }

    execSync("docker compose config", {
      cwd: root,
      stdio: "pipe",
      env: {
        ...process.env,
        AUTH_SECRET: "test-secret",
      },
    });
  });
});
