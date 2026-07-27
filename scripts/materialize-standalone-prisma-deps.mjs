#!/usr/bin/env node
/**
 * Merge @uwe/database runtime dependencies into Next.js standalone node_modules.
 * Mirrors the Docker production image strategy (pnpm deploy --prod + copy).
 *
 * Important: preserve pnpm symlinks (cp -a). Dereferencing breaks @libsql/core resolution.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(import.meta.dirname, "..");
// Brain gehört dazu, seit es eigene public/-Assets ausliefert (Szenenbilder) —
// ohne diesen Eintrag 404en sie im Standalone-Build.
const APPS = ["studio", "portal", "brain"];
const DEPLOY_DIR = path.join(ROOT, ".cache", "standalone-prisma-deps");

function copyPath(src, dest, { dereference = false } = {}) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }

  const flags = dereference ? ["-rL"] : ["-a"];
  execFileSync("cp", [...flags, src, dest], { stdio: "inherit" });
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

    copyPath(path.join(srcStore, entry), path.join(destStore, entry));
  }
}

function mergeDeployNodeModules(srcRoot, destRoot) {
  const srcNodeModules = path.join(srcRoot, "node_modules");
  const destNodeModules = path.join(destRoot, "node_modules");

  if (!fs.existsSync(srcNodeModules) || !fs.existsSync(destNodeModules)) {
    throw new Error(`node_modules missing under ${srcRoot} or ${destRoot}`);
  }

  mergePnpmStore(path.join(srcNodeModules, ".pnpm"), path.join(destNodeModules, ".pnpm"));

  for (const entry of fs.readdirSync(srcNodeModules)) {
    if (entry === ".pnpm" || entry === "node_modules") {
      continue;
    }

    if (entry === "@prisma") {
      const destScope = path.join(destNodeModules, "@prisma");
      fs.mkdirSync(destScope, { recursive: true });
      for (const pkg of ["adapter-libsql", "adapter-pg"]) {
        const srcPkg = path.join(srcNodeModules, "@prisma", pkg);
        if (fs.existsSync(srcPkg)) {
          copyPath(srcPkg, path.join(destScope, pkg));
        }
      }
      continue;
    }

    copyPath(path.join(srcNodeModules, entry), path.join(destNodeModules, entry));
  }
}

function materializeStaticAssets(app, standaloneDir) {
  const staticSrc = path.join(ROOT, "apps", app, ".next", "static");
  const staticDest = path.join(standaloneDir, "apps", app, ".next", "static");

  if (!fs.existsSync(staticSrc)) {
    console.warn(`[materialize] Skipping ${app} static assets: ${staticSrc} not found`);
    return;
  }

  copyPath(staticSrc, staticDest, { dereference: true });
}

function materializePublicAssets(app, standaloneDir) {
  // Next.js standalone output never includes `public/` on its own (documented
  // upstream requirement) — without this copy, every public asset (icons,
  // manifest, the embedded Terra map editor under public/terra/) 404s in
  // production, which for an iframed editor surfaces as the app's own
  // not-found page rendered inside the embed.
  const publicSrc = path.join(ROOT, "apps", app, "public");
  const publicDest = path.join(standaloneDir, "apps", app, "public");

  if (!fs.existsSync(publicSrc)) {
    console.warn(`[materialize] Skipping ${app} public assets: ${publicSrc} not found`);
    return;
  }

  copyPath(publicSrc, publicDest, { dereference: true });
}

function materializeApp(app) {
  const standaloneDir = path.join(ROOT, "apps", app, ".next", "standalone");
  if (!fs.existsSync(standaloneDir)) {
    console.warn(`[materialize] Skipping ${app}: standalone output not found`);
    return false;
  }

  mergeDeployNodeModules(DEPLOY_DIR, standaloneDir);

  const generatedSrc = path.join(ROOT, "packages", "database", "src", "generated");
  const generatedDest = path.join(standaloneDir, "packages", "database", "src", "generated");
  if (fs.existsSync(generatedSrc)) {
    copyPath(generatedSrc, generatedDest, { dereference: true });
  }

  materializeStaticAssets(app, standaloneDir);
  materializePublicAssets(app, standaloneDir);

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
