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
    assert.ok(fs.existsSync(path.join(root, ".env.production.example")));
    assert.ok(fs.existsSync(path.join(root, "docs/deployment-hardening.md")));
    assert.ok(fs.existsSync(path.join(root, "docs/UWE_HOST_LINUX_STARTUP.md")));
    assert.ok(fs.existsSync(path.join(root, "deploy/systemd/uwe.service")));
    assert.ok(fs.existsSync(path.join(root, "deploy/scripts/setup-uwe-host.sh")));
    assert.ok(fs.existsSync(path.join(root, "deploy/scripts/uwe-host-setup.sh")));
    // Legacy unit kept for migration docs only — production uses uwe.service
    assert.ok(fs.existsSync(path.join(root, "deploy/linux/uwe-host.service")));
    assert.ok(fs.existsSync(path.join(root, "scripts/uwe-host-start.sh")));
    assert.ok(fs.existsSync(path.join(root, "scripts/uwe-host-stop.sh")));
    assert.ok(fs.existsSync(path.join(root, "scripts/uwe-host-status.sh")));
    assert.ok(fs.existsSync(path.join(root, "scripts/install-uwe-autostart.sh")));
    assert.ok(fs.existsSync(path.join(root, "VERSION")));
    assert.ok(fs.existsSync(path.join(root, "scripts/docker-entrypoint.sh")));
  });

  it("setup-uwe-host.sh supports production modes", () => {
    const setup = fs.readFileSync(path.join(root, "deploy/scripts/setup-uwe-host.sh"), "utf8");
    for (const flag of ["--quick", "--repair", "--fresh", "--healthcheck"]) {
      assert.match(setup, new RegExp(flag.replace("-", "\\-")));
    }
    assert.match(setup, /SYSTEMD_UNIT="uwe\.service"/);
    assert.match(setup, /UWE_ENV_FILE="\/etc\/uwe\/uwe\.env"/);
    assert.match(setup, /db:generate/);
    assert.match(setup, /db:deploy/);
    assert.match(setup, /verify_all_standalone_runtime_deps/);
    assert.match(setup, /Environment=PATH=/);
  });

  it("start-uwe.sh resolves node via absolute path and stable PATH", () => {
    const start = fs.readFileSync(path.join(root, "deploy/scripts/start-uwe.sh"), "utf8");
    assert.match(start, /set -Eeuo pipefail/);
    assert.match(start, /NODE_BIN="\$\(command -v node/);
    assert.match(start, /exec "\$NODE_BIN"/);
    assert.match(start, /Node\.js not found in systemd PATH/);
  });

  it("includes standalone Prisma runtime scripts and next tracing config", () => {
    assert.ok(fs.existsSync(path.join(root, "scripts/check-standalone-prisma-deps.mjs")));
    assert.ok(fs.existsSync(path.join(root, "scripts/materialize-standalone-prisma-deps.mjs")));
    assert.ok(fs.existsSync(path.join(root, "packages/config/next-standalone.ts")));

    const studioNext = fs.readFileSync(path.join(root, "apps/studio/next.config.ts"), "utf8");
    assert.match(studioNext, /getUweStandaloneNextConfig/);
    assert.match(studioNext, /output:\s*"standalone"/);

    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    assert.match(pkg.scripts.build, /materialize-standalone-prisma-deps/);
    assert.match(pkg.scripts["build:standalone-check"], /check-standalone-prisma-deps/);
  });

  it("host scripts target uwe.service not uwe-host.service", () => {
    const lib = fs.readFileSync(path.join(root, "scripts/uwe-host-lib.sh"), "utf8");
    assert.match(lib, /SYSTEMD_UNIT="\$\{SYSTEMD_UNIT:-uwe\.service\}"/);
    const start = fs.readFileSync(path.join(root, "scripts/uwe-host-start.sh"), "utf8");
    assert.doesNotMatch(start, /nohup.*uwe-host-run/);
  });

  it("defines host convenience scripts in root package.json", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    for (const key of [
      "host:start",
      "host:stop",
      "host:status",
      "host:install-autostart",
      "host:uninstall-autostart",
    ]) {
      assert.ok(pkg.scripts[key], `missing package.json script: ${key}`);
    }
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

  it("passes shellcheck on host setup scripts when shellcheck is available", () => {
    try {
      execSync("shellcheck --version", { stdio: "pipe" });
    } catch {
      return;
    }

    execSync(
      "shellcheck -S warning deploy/scripts/setup-uwe-host.sh deploy/scripts/uwe-host-setup.sh deploy/scripts/start-uwe.sh",
      { cwd: root, stdio: "pipe" },
    );
  });
});
