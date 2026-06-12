#!/usr/bin/env node
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const distDir = path.join(packageRoot, "dist");
const exeDir = path.join(distDir, "exe");

function run(command) {
  console.log(`> ${command}`);
  execSync(command, { cwd: packageRoot, stdio: "inherit" });
}

fs.mkdirSync(exeDir, { recursive: true });

run("pnpm run build");

const entry = path.join(distDir, "cli.js");
const output = path.join(exeDir, "UWE-Setup.exe");

const pkgBin = path.join(
  packageRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "pkg.cmd" : "pkg",
);

if (!fs.existsSync(pkgBin)) {
  console.log("");
  console.log("pkg is not installed in tools/windows-installer.");
  console.log("On Windows CI, run: pnpm --filter @uwe/windows-installer add -D @yao-pkg/pkg");
  console.log("Prepared CLI build is available at:", entry);
  console.log("Use scripts/windows/uwe-launcher.ps1 until the EXE artifact is produced.");
  process.exit(0);
}

run(
  `"${pkgBin}" "${entry}" --targets node20-win-x64 --output "${output}" --config pkg.config.json`,
);

console.log("");
console.log("Windows installer EXE built:");
console.log(output);
