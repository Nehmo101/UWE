/**
 * File size budget regression test — anti-monolith guard.
 * Policy: CLAUDE.md § Modul-Disziplin, AGENTS.md § File size budget.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { checkFileSizeBudget, NEW_FILE_MAX_LINES } from "./file-size-budget-check.mjs";

const root = path.resolve(import.meta.dirname, "..");

describe("file size budget", () => {
  it("keeps production files within their size budget", () => {
    const { violations } = checkFileSizeBudget();
    const details = violations
      .map((violation) => `${violation.file}: ${violation.lines} lines (budget ${violation.allowed})`)
      .join("\n");
    assert.equal(
      violations.length,
      0,
      `Oversized files — split into modules or a feature package instead of growing them ` +
        `(new-file budget: ${NEW_FILE_MAX_LINES} lines; never raise scripts/file-size-baseline.json):\n${details}`,
    );
  });

  it("has no stale baseline entries", () => {
    const { staleEntries } = checkFileSizeBudget();
    assert.equal(
      staleEntries.length,
      0,
      `Baseline entries without a matching file — run \`node scripts/file-size-budget-check.mjs --ratchet\`:\n${staleEntries.join("\n")}`,
    );
  });

  it("is wired into the test pipelines", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    assert.match(pkg.scripts.test, /file-size-budget/);
    assert.match(pkg.scripts["test:ci"], /file-size-budget/);
  });
});
