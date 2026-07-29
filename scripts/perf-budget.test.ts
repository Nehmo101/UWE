/**
 * Runtime perf budget tooling regression test.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { checkPerfBudgets, RUNTIME_BUDGETS_MS } from "./perf-budget-check.mjs";

const root = path.resolve(import.meta.dirname, "..");

describe("runtime perf budget tooling", () => {
  it("passes when all metrics are within budget", () => {
    const result = checkPerfBudgets([
      { route: "studio:/worlds", lcp: 1200, fcp: 700, load: 1800 },
      { route: "portal:/worlds", lcp: 1000, fcp: 600, load: 1500 },
    ]);
    assert.equal(result.ok, true);
    assert.equal(result.failures.length, 0);
    assert.ok(result.checked >= 6);
  });

  it("fails and reports the breached metric", () => {
    const result = checkPerfBudgets([
      { route: "studio:/worlds", lcp: 9999, fcp: 700, load: 1800 },
    ]);
    assert.equal(result.ok, false);
    assert.equal(result.failures.length, 1);
    assert.match(result.failures[0], /studio:\/worlds lcp/);
  });

  it("ignores unbudgeted routes and missing metrics", () => {
    const result = checkPerfBudgets([
      { route: "studio:/unknown", lcp: 99999 },
      { route: "portal:/worlds", fcp: 100 },
    ]);
    assert.equal(result.ok, true);
    assert.equal(result.checked, 1);
  });

  it("exposes runtime budgets and a check script", () => {
    assert.ok(RUNTIME_BUDGETS_MS["studio:/worlds"]);
    assert.ok(RUNTIME_BUDGETS_MS["portal:/worlds"]);
    assert.ok(fs.existsSync(path.join(root, "scripts/perf-budget-check.mjs")));
  });

  it("wires perf:budget into the pnpm scripts", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    assert.ok(pkg.scripts["perf:budget"]);
    assert.match(pkg.scripts["perf:budget"], /perf-budget-check/);
  });
});
