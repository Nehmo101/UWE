import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CONNECTOR_NAV,
  connectorNavConflicts,
  connectorNavItems,
  connectorSidebar,
} from "./connector-nav";

describe("connectorNavItems", () => {
  it("flattens all groups into a single owner-only connector list", () => {
    const items = connectorNavItems();

    assert.equal(items.length, 8);
    for (const item of items) {
      assert.equal(item.section, "Command Center");
      assert.equal(item.source, "connector");
      assert.deepEqual(item.permission, ["owner"]);
      assert.equal(item.status, "active");
      assert.ok((item.keywords ?? []).length > 0, `item ${item.id} has search keywords`);
    }
  });

  it("keeps the command center at root and RTX settings on a dedicated route", () => {
    const host = connectorNavItems().find((item) => item.id === "connector-host");

    const center = connectorNavItems().find((item) => item.id === "command-center");
    assert.ok(host, "connector-host item exists");
    assert.equal(host.href, "/connector");
    assert.ok(center, "command-center item exists");
    assert.equal(center.href, "/");
  });
});

describe("connectorNavConflicts", () => {
  it("has no duplicate ids, hrefs, or labels", () => {
    assert.deepEqual(connectorNavConflicts(), {
      duplicateIds: [],
      duplicateHrefs: [],
      duplicateLabels: [],
    });
  });
});

describe("connectorSidebar", () => {
  it("marks exactly the matching item active for a top-level route", () => {
    const groups = connectorSidebar("/jobs");
    const items = groups.flatMap((group) => group.items);
    const active = items.filter((item) => item.active);

    assert.deepEqual(
      active.map((item) => item.id),
      ["connector-jobs"],
    );
  });

  it("treats the root href as exact match only (no catch-all)", () => {
    const activeOnLogs = connectorSidebar("/logs")
      .flatMap((group) => group.items)
      .filter((item) => item.active)
      .map((item) => item.id);
    assert.deepEqual(activeOnLogs, ["connector-logs"]);

    const activeOnRoot = connectorSidebar("/")
      .flatMap((group) => group.items)
      .filter((item) => item.active)
      .map((item) => item.id);
    assert.deepEqual(activeOnRoot, ["command-center"]);
  });

  it("marks parents active for nested child routes", () => {
    const active = connectorSidebar("/models/llama3-1-8b")
      .flatMap((group) => group.items)
      .filter((item) => item.active)
      .map((item) => item.id);

    assert.deepEqual(active, ["connector-models"]);
  });

  it("preserves group structure from CONNECTOR_NAV", () => {
    const groups = connectorSidebar("/runner");

    assert.equal(groups.length, CONNECTOR_NAV.length);
    assert.equal(groups[0]?.id, "connector-main");
    assert.equal(groups[0]?.items.length, CONNECTOR_NAV[0]?.items.length);
  });
});
