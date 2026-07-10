import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_STUDIO_TODAY_LAYOUT,
  STUDIO_TODAY_PAGE_KEY,
  getDefaultDashboardLayout,
  normalizeDashboardWidgets,
  portalWorldPageKey,
  validateDashboardWidgets,
} from "./dashboard-layout-types";

describe("dashboard layout defaults", () => {
  it("provides studio today defaults", () => {
    const defaults = getDefaultDashboardLayout(STUDIO_TODAY_PAGE_KEY);
    assert.deepEqual(defaults, DEFAULT_STUDIO_TODAY_LAYOUT);
  });

  it("provides portal defaults per world slug", () => {
    const pageKey = portalWorldPageKey("terra");
    const defaults = getDefaultDashboardLayout(pageKey);
    assert.ok(defaults.length > 0);
    assert.equal(defaults[0]?.widgetType, "next-session");
  });

  it("normalizes widget order within columns", () => {
    const normalized = normalizeDashboardWidgets([
      { id: "b", widgetType: "projects", order: 5, column: 2, visible: true },
      { id: "a", widgetType: "dnd-favorite", order: 1, column: 2, visible: true },
    ]);

    assert.deepEqual(
      normalized.map((entry) => entry.id),
      ["a", "b"],
    );
    assert.equal(normalized[0]?.order, 0);
    assert.equal(normalized[1]?.order, 1);
  });

  it("validates required widget fields", () => {
    const result = validateDashboardWidgets(STUDIO_TODAY_PAGE_KEY, [
      { id: "", widgetType: "projects", order: 0, column: 1, visible: true },
    ]);
    assert.equal(result.ok, false);
  });
});
