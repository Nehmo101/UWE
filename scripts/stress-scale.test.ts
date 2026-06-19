import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PERF_MEGA_SCALE,
  PERF_STRESS_SCALE,
  resolveStressScale,
} from "../packages/database/src/perf-budgets";

describe("resolveStressScale", () => {
  it("defaults to stress scale", () => {
    const scale = resolveStressScale({});
    assert.equal(scale.pages, PERF_STRESS_SCALE.pages);
  });

  it("selects mega scale from env", () => {
    const scale = resolveStressScale({ UWE_STRESS_SCALE: "mega" });
    assert.equal(scale.pages, PERF_MEGA_SCALE.pages);
  });

  it("accepts 10k alias", () => {
    const scale = resolveStressScale({ UWE_STRESS_SCALE: "10k" });
    assert.equal(scale.pages, PERF_MEGA_SCALE.pages);
  });
});
