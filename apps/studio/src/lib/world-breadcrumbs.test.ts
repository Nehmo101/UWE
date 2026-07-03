import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { STUDIO_SESSION_ENTRY_PATH } from "@uwe/auth";
import { studioDashboardBreadcrumb, worldRootBreadcrumb } from "./world-breadcrumbs";

describe("world breadcrumbs", () => {
  it("links Dashboard to the logged-in Studio entry, not legacy /studio", () => {
    const crumb = studioDashboardBreadcrumb();
    assert.equal(crumb.label, "Dashboard");
    assert.equal(crumb.href, STUDIO_SESSION_ENTRY_PATH);
    assert.notEqual(crumb.href, "/studio");
  });

  it("builds world root breadcrumb with session entry and world dashboard", () => {
    const items = worldRootBreadcrumb("Terra", "terra");
    assert.deepEqual(items, [
      { label: "Dashboard", href: STUDIO_SESSION_ENTRY_PATH },
      { label: "Terra", href: "/worlds/terra/dashboard" },
    ]);
  });
});
