#!/usr/bin/env node
/**
 * Merge @uwe/database runtime dependencies into Next.js standalone node_modules.
 * Mirrors the Docker production image strategy (pnpm deploy --prod + copy).
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(import.meta.dirname, "..");
const APPS = ["studio", "portal"];
const DEPLOY_DIR = path.join(ROOT, ".cache", "standalone-prisma-deps");

/** Top-level node_modules entries copied from the prod deploy tree. */
const TOP_LEVEL_RUNTIME_ENTRIES = ["@prisma", "@libsql", "pg", "libsql"];

function copyDereferenced(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }
  execFileSync("cp", ["-rL", src, dest], { stdio: "inherit" });
}

function mergePnpmStore(srcStore, destStore) {
  if (!fs.existsSync(srcStore)) {
    return;
  }

  fs.mkdirSync(destStore, { recursive: true });

  for (const entry of fs.readdirSync(srcStore)) {
    // pnpm's internal symlink hub — not real packages.
    if (entry === "node_modules") {
      continue;
    }

    copyDereferenced(path.join(srcStore, entry), path.join(destStore, entry));
  }
}

function materializeRuntimeNodeModules(srcRoot, destRoot) {
  const srcNodeModules = path.join(srcRoot, "node_modules");
  const destNodeModules = path.join(destRoot, "node_modules");

  if (!fs.existsSync(srcNodeModules) || !fs.existsSync(destNodeModules)) {
    throw new Error(`node_modules missing under ${srcRoot} or ${destRoot}`);
  }

  mergePnpmStore(path.join(srcNodeModules, ".pnpm"), path.join(destNodeModules, ".pnpm"));

  for (const entry of TOP_LEVEL_RUNTIME_ENTRIES) {
    const src = path.join(srcNodeModules, entry);
    if (!fs.existsSync(src)) {
      continue;
    }
    copyDereferenced(src, path.join(destNodeModules, entry));
  }
}

function materializeApp(app) {
  const standaloneDir = path.join(ROOT, "apps", app, ".next", "standalone");
  if (!fs.existsSync(standaloneDir)) {
    console.warn(`[materialize] Skipping ${app}: standalone output not found`);
    return false;
  }

  materializeRuntimeNodeModules(DEPLOY_DIR, standaloneDir);

  const generatedSrc = path.join(ROOT, "packages", "database", "src", "generated");
  const generatedDest = path.join(standaloneDir, "packages", "database", "src", "generated");
  if (fs.existsSync(generatedSrc)) {
    copyDereferenced(generatedSrc, generatedDest);
  }

  console.log(`[materialize] Updated standalone runtime deps for ${app}`);
  return true;
}

fs.rmSync(DEPLOY_DIR, { recursive: true, force: true });
fs.mkdirSync(DEPLOY_DIR, { recursive: true });

execFileSync(
  "pnpm",
  ["--filter", "@uwe/database", "deploy", "--legacy", "--prod", DEPLOY_DIR],
  { cwd: ROOT, stdio: "inherit" },
);

let materialized = 0;
for (const app of APPS) {
  if (materializeApp(app)) {
    materialized += 1;
  }
}

if (materialized === 0) {
  console.error("[materialize] No standalone outputs found. Run next build first.");
  process.exit(1);
}
