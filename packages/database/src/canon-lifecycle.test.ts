import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CANONICAL_LIFECYCLE_FILTER_STATUSES,
  isCanonicalLifecycleFilterStatus,
} from "./canon-lifecycle";

describe("canon lifecycle filters", () => {
  it("exposes lifecycle statuses for studio filters", () => {
    assert.ok(CANONICAL_LIFECYCLE_FILTER_STATUSES.includes("prepared"));
    assert.ok(CANONICAL_LIFECYCLE_FILTER_STATUSES.includes("played"));
    assert.ok(CANONICAL_LIFECYCLE_FILTER_STATUSES.includes("discarded"));
  });

  it("validates filter query params", () => {
    assert.equal(isCanonicalLifecycleFilterStatus("prepared"), true);
    assert.equal(isCanonicalLifecycleFilterStatus("deprecated"), false);
    assert.equal(isCanonicalLifecycleFilterStatus(undefined), false);
  });
});
