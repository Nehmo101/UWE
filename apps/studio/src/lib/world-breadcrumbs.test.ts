import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { STUDIO_SESSION_ENTRY_PATH } from "@uwe/auth";
import {
  studioDashboardBreadcrumb,
  worldRootBreadcrumb,
  worldsRootBreadcrumb,
} from "./world-breadcrumbs";

describe("world breadcrumbs", () => {
  it("links the root segment to the logged-in Studio entry, not legacy /studio", () => {
    const crumb = studioDashboardBreadcrumb();
    assert.equal(crumb.href, STUDIO_SESSION_ENTRY_PATH);
    assert.notEqual(crumb.href, "/studio");
  });

  it("labels the root segment after its target (the world list), not a dashboard", () => {
    assert.equal(studioDashboardBreadcrumb().label, "Welten");
  });

  it("builds world root breadcrumb with session entry and world dashboard", () => {
    const items = worldRootBreadcrumb("Terra", "terra");
    assert.deepEqual(items, [
      { label: "Welten", href: STUDIO_SESSION_ENTRY_PATH },
      { label: "Terra", href: "/worlds/terra/dashboard" },
    ]);
  });

  it("does not link the world list to itself", () => {
    assert.deepEqual(worldsRootBreadcrumb(), [{ label: "Welten" }]);
  });
});
