#!/usr/bin/env node
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const innoScript = path.join(__dirname, "../inno/UWE-Setup.iss");
const isccCandidates = [
  "C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe",
  "C:\\Program Files\\Inno Setup 6\\ISCC.exe",
  process.env.ISCC,
].filter(Boolean);

function findIscc() {
  for (const candidate of isccCandidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  try {
    execSync("iscc /?", { stdio: "ignore" });
    return "iscc";
  } catch {
    return null;
  }
}

const iscc = findIscc();

if (!iscc) {
  console.log("Inno Setup (iscc) not found.");
  console.log("Install from: https://jrsoftware.org/isinfo.php");
  console.log("Then run: iscc tools/windows-installer/inno/UWE-Setup.iss");
  console.log("");
  console.log("Alternative: use UWE-Setup.exe from pkg build or run uwe-wizard.ps1 directly.");
  process.exit(0);
}

execSync(`"${iscc}" "${innoScript}"`, { stdio: "inherit" });
console.log("Inno Setup installer built in tools/windows-installer/dist/exe/");
