#!/usr/bin/env node
/**
 * QA smoke runner — orchestrates existing test commands (no fake greens).
 * See docs/design/uwe-qa-automation.md
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readScripts() {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  return pkg.scripts ?? {};
}

function runStep(label, command, args, { optional = false } = {}) {
  console.log(`\n=== ${label} ===\n`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: false,
  });

  if (result.status !== 0) {
    if (optional) {
      console.warn(`\nqa-smoke: optional step skipped (${label}) — exit ${result.status ?? 1}`);
      return false;
    }
    console.error(`\nqa-smoke: FAILED at ${label}`);
    process.exit(result.status ?? 1);
  }

  return true;
}

function a11yE2eAvailable(scripts) {
  if (scripts["test:e2e:a11y"]) {
    return { command: "pnpm", args: ["test:e2e:a11y"] };
  }

  const studioSpec = path.join(root, "e2e/studio-a11y.spec.ts");
  const portalSpec = path.join(root, "e2e/portal-a11y.spec.ts");
  if (fs.existsSync(studioSpec) && fs.existsSync(portalSpec)) {
    return {
      command: "pnpm",
      args: ["test:e2e", "e2e/studio-a11y.spec.ts", "e2e/portal-a11y.spec.ts"],
    };
  }

  return null;
}

const scripts = readScripts();

runStep("Studio IA (studio-navigation + mobile-nav)", "pnpm", ["--filter", "@uwe/studio", "test"]);

runStep("Design V2 theme presets (unit)", "pnpm", [
  "--filter",
  "@uwe/shared-ui",
  "exec",
  "node",
  "--import",
  "tsx",
  "--test",
  "src/design-v2/design-v2.test.ts",
]);

const a11y = a11yE2eAvailable(scripts);
if (a11y) {
  runStep("Accessibility E2E (axe-core smoke)", a11y.command, a11y.args);
} else {
  console.warn(
    "\nqa-smoke: skipping a11y E2E — add pnpm test:e2e:a11y (PR #243) or e2e/*-a11y.spec.ts",
  );
}

runStep("Security (test:security)", "pnpm", ["test:security"]);

console.log("\nqa-smoke: all required steps passed");
