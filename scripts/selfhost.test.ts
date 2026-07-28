import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "..");

describe("self-hosting setup", () => {
  it("includes host setup and env files", () => {
    assert.ok(fs.existsSync(path.join(root, ".env.example")));
    assert.ok(fs.existsSync(path.join(root, ".env.production.example")));
    assert.ok(fs.existsSync(path.join(root, "docs/deployment-hardening.md")));
    assert.ok(fs.existsSync(path.join(root, "docs/UWE_HOST_LINUX_STARTUP.md")));
    assert.ok(fs.existsSync(path.join(root, "deploy/systemd/uwe.service")));
    assert.ok(fs.existsSync(path.join(root, "deploy/systemd/uwe-rtx-connector.service")));
    assert.ok(fs.existsSync(path.join(root, "deploy/scripts/setup-uwe-host.sh")));
    assert.ok(fs.existsSync(path.join(root, "deploy/scripts/lib/uwe-host-constants.sh")));
    assert.ok(fs.existsSync(path.join(root, "deploy/scripts/lib/uwe-host-platform.sh")));
    assert.ok(fs.existsSync(path.join(root, "deploy/scripts/fedora-host-smoke.sh")));
    assert.ok(fs.existsSync(path.join(root, "scripts/uwe-host-start.sh")));
    assert.ok(fs.existsSync(path.join(root, "scripts/uwe-host-stop.sh")));
    assert.ok(fs.existsSync(path.join(root, "scripts/uwe-host-status.sh")));
    assert.ok(fs.existsSync(path.join(root, "scripts/install-uwe-autostart.sh")));
    assert.ok(fs.existsSync(path.join(root, "VERSION")));
  });

  it("setup-uwe-host.sh supports production modes and lib modules", () => {
    const setup = fs.readFileSync(path.join(root, "deploy/scripts/setup-uwe-host.sh"), "utf8");
    const deps = fs.readFileSync(path.join(root, "deploy/scripts/lib/uwe-host-deps.sh"), "utf8");
    const connectorInstall = fs.readFileSync(
      path.join(root, "deploy/scripts/lib/uwe-host-connector-install.sh"),
      "utf8",
    );
    for (const flag of ["--quick", "--repair", "--fresh", "--healthcheck"]) {
      assert.match(setup, new RegExp(flag.replace("-", "\\-")));
    }
    assert.match(setup, /source "\$LIB_DIR\/uwe-host-preflight\.sh"/);
    assert.match(setup, /source "\$LIB_DIR\/uwe-host-deps\.sh"/);
    assert.match(setup, /source "\$LIB_DIR\/uwe-host-platform\.sh"/);
    assert.match(setup, /run_preflight/);
    assert.match(setup, /StartLimitIntervalSec=300/);
    assert.match(setup, /StartLimitBurst=5/);
    assert.match(setup, /RestartSec=5/);
    assert.match(setup, /run_deploy_steps/);
    assert.match(deps, /verify_all_standalone_runtime_deps/);
    assert.match(deps, /verify_service_node_access/);

    for (const lib of [
      "deploy/scripts/lib/uwe-host-common.sh",
      "deploy/scripts/lib/uwe-host-preflight.sh",
      "deploy/scripts/lib/uwe-host-deps.sh",
      "deploy/scripts/lib/uwe-host-platform.sh",
      "deploy/scripts/lib/uwe-host-connector-install.sh",
      "deploy/scripts/lib/uwe-host-ai-diagnostics.sh",
    ]) {
      assert.ok(fs.existsSync(path.join(root, lib)), `missing ${lib}`);
    }

    assert.match(deps, /install_node_from_nodesource/);
    assert.match(deps, /install_node_from_fedora/);
    assert.match(deps, /nodejs22-bin nodejs22-npm-bin/);
    assert.match(setup, /install_rtx_connector_unit/);
    assert.match(connectorInstall, /systemctl disable --now/);
    assert.match(deps, /diagnose_node_install_failure/);
    assert.match(deps, /pnpm --filter '\$DATABASE_WORKSPACE_FILTER' db:generate/);
    assert.match(deps, /pnpm --filter '\$DATABASE_WORKSPACE_FILTER' db:deploy/);
    assert.match(deps, /verify_migrations_applied/);
    assert.match(setup, /stop_uwe_service_for_maintenance/);
  });

  it("start-uwe.sh resolves node via absolute path and stable PATH", () => {
    const start = fs.readFileSync(path.join(root, "deploy/scripts/start-uwe.sh"), "utf8");
    assert.match(start, /set -Eeuo pipefail/);
    assert.match(start, /resolve_node_binary/);
    assert.match(start, /\/usr\/bin\/node/);
    assert.match(start, /NODE_BIN="\$\(resolve_node_binary/);
    assert.match(start, /exec "\$NODE_BIN"/);
    assert.match(start, /Node\.js not found in systemd PATH/);
    assert.match(start, /setup-uwe-host\.sh --repair/);
    assert.match(start, /Starting Studio on PORT=/);
    assert.match(start, /Starting Portal on PORT=/);
    assert.doesNotMatch(start, /pnpm not found/);
  });

  // Der Apex-Origin ist eine eigene App (apps/landing). Wird sie hier nicht
  // gestartet, lauscht auf LANDING_PORT niemand und der Tunnel-Ingress der
  // Hauptdomain bleibt zwangsläufig auf Studio stehen — genau der Zustand, den
  // apps/landing beseitigen soll.
  it("start-uwe.sh startet die Apex-Startseite auf LANDING_PORT", () => {
    const start = fs.readFileSync(path.join(root, "deploy/scripts/start-uwe.sh"), "utf8");
    assert.match(start, /LANDING_PORT="\$\{LANDING_PORT:-3103\}"/);
    assert.match(start, /apps\/landing\/\.next\/standalone/);
    assert.match(start, /Starting Landing on PORT=/);
    assert.match(start, /exec "\$NODE_BIN" apps\/landing\/server\.js/);
    // Startseite und Family sind beide optional, deshalb sammelt das Skript die
    // tatsächlich gestarteten PIDs ein, statt eine leere Variable an `wait -n`
    // zu reichen — das bräche den Dienst beim Start.
    assert.match(start, /WAIT_PIDS\+=\("\$LANDING_PID"\)/);
    assert.match(start, /wait -n "\$\{WAIT_PIDS\[@\]\}"/);
  });

  it("start-uwe.sh startet Family, wenn ein Standalone-Build vorliegt", () => {
    const start = fs.readFileSync(path.join(root, "deploy/scripts/start-uwe.sh"), "utf8");
    assert.match(start, /FAMILY_PORT="\$\{FAMILY_PORT:-3004\}"/);
    assert.match(start, /apps\/family\/\.next\/standalone/);
    assert.match(start, /exec "\$NODE_BIN" apps\/family\/server\.js/);
    // Family trägt Haushaltsdaten und ist über den Tunnel erreichbar, nicht im LAN.
    assert.match(start, /export HOSTNAME="127\.0\.0\.1"/);
    assert.match(start, /WAIT_PIDS\+=\("\$FAMILY_PID"\)/);
  });

  it("Landing-Standalone bekommt Runtime-Deps und wird geprüft", () => {
    const materialize = fs.readFileSync(
      path.join(root, "scripts/materialize-standalone-prisma-deps.mjs"),
      "utf8",
    );
    assert.match(materialize, /const APPS = \[[^\]]*"landing"[^\]]*\]/);

    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    assert.match(pkg.scripts["build:standalone-check"], /check-standalone-prisma-deps\.mjs landing/);

    const deps = fs.readFileSync(path.join(root, "deploy/scripts/lib/uwe-host-deps.sh"), "utf8");
    assert.match(deps, /verify_standalone_runtime_deps "landing"/);
  });

  it("configure-cloudflare-tunnel.sh leitet Hostnamen aus der Host-Konfiguration ab", () => {
    const configure = fs.readFileSync(
      path.join(root, "deploy/scripts/configure-cloudflare-tunnel.sh"),
      "utf8",
    );
    // Fest verdrahtete Beispiel-Hostnamen würden eine fremde Domain
    // konfigurieren und den echten Apex unverändert auf Studio lassen.
    assert.doesNotMatch(configure, /"hostname": "[^"]*uwe\.example"/);
    assert.match(configure, /PUBLIC_BASE_URL/);
    assert.match(configure, /--apex-domain/);
    assert.match(configure, /LANDING_PORT/);
  });

  it("uwe.service reference unit limits restart loops and pins node path", () => {
    const unit = fs.readFileSync(path.join(root, "deploy/systemd/uwe.service"), "utf8");
    assert.match(unit, /StartLimitIntervalSec=300/);
    assert.match(unit, /StartLimitBurst=5/);
    assert.match(unit, /RestartSec=5/);
    assert.match(unit, /EnvironmentFile=-\/etc\/uwe\/uwe\.env/);
    assert.match(unit, /Environment=PATH=/);
    assert.match(unit, /Environment=NODE_BIN=/);
    assert.match(unit, /Environment=XDG_CACHE_HOME=\/var\/lib\/uwe\/cache/);
    const envFileIndex = unit.indexOf("EnvironmentFile=-/etc/uwe/uwe.env");
    const pathIndex = unit.indexOf("Environment=PATH=");
    assert.ok(envFileIndex >= 0 && pathIndex > envFileIndex, "PATH must come after EnvironmentFile");
  });

  it("RTX connector systemd unit is optional, outbound and host-hardened", () => {
    const unit = fs.readFileSync(
      path.join(root, "deploy/systemd/uwe-rtx-connector.service"),
      "utf8",
    );
    assert.match(unit, /ConditionPathExists=\/opt\/uwe\/tools\/uwe-rtx-connector\/\.env/);
    assert.match(unit, /ExecStart=\/usr\/bin\/node --import tsx/);
    assert.match(unit, /RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6/);
    assert.doesNotMatch(unit, /ListenStream|IPAddressAllow/);
  });
  it("Host Command Center keeps Fedora DNF cache in the writable data directory", () => {
    const unit = fs.readFileSync(
      path.join(root, "deploy/systemd/uwe-host-command-center.service"),
      "utf8",
    );
    assert.match(unit, /Environment=XDG_CACHE_HOME=\/var\/lib\/uwe\/cache/);
    assert.match(unit, /ReadWritePaths=.*\/var\/lib\/uwe/);
  });

  it("includes standalone Prisma runtime scripts and next tracing config", () => {
    assert.ok(fs.existsSync(path.join(root, "scripts/check-standalone-prisma-deps.mjs")));
    assert.ok(fs.existsSync(path.join(root, "scripts/materialize-standalone-prisma-deps.mjs")));
    assert.ok(fs.existsSync(path.join(root, "packages/config/next-standalone.ts")));

    const materialize = fs.readFileSync(
      path.join(root, "scripts/materialize-standalone-prisma-deps.mjs"),
      "utf8",
    );
    assert.match(materialize, /adapter-libsql/);
    assert.match(materialize, /materializeStaticAssets/);
    assert.match(materialize, /materializePublicAssets/);

    const check = fs.readFileSync(path.join(root, "scripts/check-standalone-prisma-deps.mjs"), "utf8");
    assert.match(check, /requireFromStandalone\(moduleName\)/);
    assert.match(check, /static assets/);
    assert.match(check, /public assets/);

    const studioNext = fs.readFileSync(path.join(root, "apps/studio/next.config.ts"), "utf8");
    assert.match(studioNext, /getUweStandaloneNextConfig/);
    assert.match(studioNext, /output:\s*"standalone"/);

    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    assert.match(pkg.scripts.build, /materialize-standalone-prisma-deps/);
    assert.match(pkg.scripts["build:standalone-check"], /check-standalone-prisma-deps/);
  });

  it("includes host update scripts and systemd unit", () => {
    for (const file of [
      "deploy/scripts/uwe-host-update.sh",
      "deploy/scripts/uwe-host-update-trigger.sh",
      "deploy/systemd/uwe-host-update.service",
      "deploy/sudoers/uwe-host-update",
      "deploy/scripts/lib/uwe-host-update-install.sh",
      "deploy/scripts/lib/uwe-host-connector-install.sh",
      "deploy/scripts/uwe-host-restart-trigger.sh",
      "deploy/sudoers/uwe-host-restart",
      "deploy/scripts/lib/uwe-host-restart-install.sh",
    ]) {
      assert.ok(fs.existsSync(path.join(root, file)), `missing ${file}`);
    }

    const setup = fs.readFileSync(path.join(root, "deploy/scripts/setup-uwe-host.sh"), "utf8");
    assert.match(setup, /install_host_update_assets/);
    assert.match(setup, /install_host_restart_assets/);
    const update = fs.readFileSync(path.join(root, "deploy/scripts/uwe-host-update.sh"), "utf8");
    assert.match(update, /setup-uwe-host\.sh --quick/);
    assert.doesNotMatch(update, /--fresh/);
    const updateUnit = fs.readFileSync(path.join(root, "deploy/systemd/uwe-host-update.service"), "utf8");
    assert.doesNotMatch(updateUnit, /Conflicts=uwe\.service/);
  });

  it("host scripts target uwe.service not uwe-host.service", () => {
    const constants = fs.readFileSync(
      path.join(root, "deploy/scripts/lib/uwe-host-constants.sh"),
      "utf8",
    );
    assert.match(constants, /UWE_DEFAULT_SYSTEMD_UNIT="uwe\.service"/);
    const lib = fs.readFileSync(path.join(root, "scripts/uwe-host-lib.sh"), "utf8");
    assert.match(lib, /SYSTEMD_UNIT="\$\{SYSTEMD_UNIT:-\$\{UWE_DEFAULT_SYSTEMD_UNIT\}\}"/);
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

  it("includes persistent data directories", () => {
    assert.ok(fs.existsSync(path.join(root, "data/uploads/.gitkeep")));
    assert.ok(fs.existsSync(path.join(root, "data/backups/.gitkeep")));
    assert.ok(fs.existsSync(path.join(root, "exports/.gitkeep")));
  });

  it("documents auto seed in env example", () => {
    const envExample = fs.readFileSync(path.join(root, ".env.example"), "utf8");
    assert.match(envExample, /RUN_DB_SEED=auto/);
  });

  it("passes shellcheck on host setup scripts when shellcheck is available", () => {
    try {
      execSync("shellcheck --version", { stdio: "pipe" });
    } catch {
      return;
    }

    execSync(
      "shellcheck -S warning deploy/scripts/setup-uwe-host.sh deploy/scripts/start-uwe.sh deploy/scripts/uwe-host-update.sh deploy/scripts/uwe-host-update-trigger.sh deploy/scripts/fedora-host-smoke.sh deploy/scripts/lib/uwe-host-constants.sh deploy/scripts/lib/uwe-host-platform.sh deploy/scripts/lib/uwe-host-common.sh deploy/scripts/lib/uwe-host-preflight.sh deploy/scripts/lib/uwe-host-deps.sh deploy/scripts/lib/uwe-host-ai-diagnostics.sh deploy/scripts/lib/uwe-host-update-install.sh deploy/scripts/lib/uwe-host-connector-install.sh",
      { cwd: root, stdio: "pipe" },
    );
  });
});
