#!/usr/bin/env node
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const releaseDir = path.join(repoRoot, "tools/windows-installer/dist/release");

function run(command, cwd = repoRoot) {
  console.log(`> ${command}`);
  execSync(command, { cwd, stdio: "inherit" });
}

console.log("Building UWE release bundle for Windows installer...");

run("pnpm install --frozen-lockfile");
run("pnpm build:release");
run("pnpm --filter @uwe/windows-installer run build");

fs.mkdirSync(releaseDir, { recursive: true });

const exclude = new Set([
  "node_modules/.cache",
  ".git",
  "tools/windows-installer/dist/exe",
  "tools/windows-installer/dist/release",
]);

function shouldCopy(relativePath) {
  for (const pattern of exclude) {
    if (relativePath.startsWith(pattern)) {
      return false;
    }
  }
  return true;
}

function copyRecursive(source, target, base = "") {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (!shouldCopy(rel)) {
      continue;
    }

    const srcPath = path.join(source, entry.name);
    const tgtPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      copyRecursive(srcPath, tgtPath, rel);
    } else {
      fs.copyFileSync(srcPath, tgtPath);
    }
  }
}

if (fs.existsSync(releaseDir)) {
  fs.rmSync(releaseDir, { recursive: true, force: true });
}

copyRecursive(repoRoot, releaseDir);

console.log("");
console.log("Release bundle ready:");
console.log(releaseDir);
console.log("");
console.log("Next: pnpm package:windows (requires Inno Setup on Windows)");
