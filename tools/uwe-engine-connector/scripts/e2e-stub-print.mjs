#!/usr/bin/env node
/**
 * Homelab E2E stub for label_print jobs.
 * Writes the print file path to stdout and copies the source file to /tmp/uwe-e2e-print/.
 *
 * Usage:
 *   UWE_CONNECTOR_PRINT_CMD="node ./scripts/e2e-stub-print.mjs"
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { basename } from "node:path";

const args = process.argv.slice(2);
let printer = "e2e-printer";
let file = "";

for (let index = 0; index < args.length; index += 1) {
  if (args[index] === "--printer" && args[index + 1]) {
    printer = args[index + 1];
    index += 1;
  } else if (args[index] === "--file" && args[index + 1]) {
    file = args[index + 1];
    index += 1;
  }
}

if (!file) {
  console.error("e2e-stub-print: --file fehlt");
  process.exit(1);
}

const outDir = process.env.UWE_E2E_PRINT_OUT_DIR ?? "/tmp/uwe-e2e-print";
mkdirSync(outDir, { recursive: true });
const target = `${outDir}/${Date.now()}-${basename(file)}`;
copyFileSync(file, target);
process.stdout.write(JSON.stringify({ printed: true, printer, file: target }));
