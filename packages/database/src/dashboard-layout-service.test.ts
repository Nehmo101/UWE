import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createAuthService } from "./auth";
import { createPrismaClient } from "./client";
import {
  DEFAULT_STUDIO_TODAY_LAYOUT,
  STUDIO_TODAY_PAGE_KEY,
  getDefaultDashboardLayout,
  normalizeDashboardWidgets,
  portalWorldPageKey,
  validateDashboardWidgets,
} from "./dashboard-layout-types";
import { createDashboardLayoutService } from "./dashboard-layout-service";
import { createTestDatabaseUrl } from "./test-helpers";

describe("DashboardLayoutService", () => {
  let databaseUrl: string;
  let userId: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);
    try {
      const user = await auth.createUser({
        displayName: "Layout Tester",
        email: "layout@test.local",
        password: "test-password-123",
        role: "owner",
      });
      userId = user.id;
    } finally {
      await db.$disconnect();
    }
  });

  after(async () => {
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("returns default layout when no row exists", async () => {
    const db = createPrismaClient(databaseUrl);
    const service = createDashboardLayoutService(db);
    try {
      const layout = await service.getDashboardLayout(userId, STUDIO_TODAY_PAGE_KEY);
      assert.equal(layout.isDefault, true);
      assert.deepEqual(layout.widgets, DEFAULT_STUDIO_TODAY_LAYOUT);
    } finally {
      await db.$disconnect();
    }
  });

  it("persists and reloads a custom layout", async () => {
    const db = createPrismaClient(databaseUrl);
    const service = createDashboardLayoutService(db);
    const custom = normalizeDashboardWidgets([
      {
        id: "homelab",
        widgetType: "homelab",
        order: 0,
        column: 1,
        visible: true,
      },
      {
        id: "projects",
        widgetType: "projects",
        order: 1,
        column: 1,
        visible: true,
      },
      {
        id: "system-ampel",
        widgetType: "system-ampel",
        order: 0,
        column: 2,
        visible: false,
      },
      {
        id: "dnd-favorite",
        widgetType: "dnd-favorite",
        order: 0,
        column: 3,
        visible: true,
      },
      {
        id: "capture-inbox",
        widgetType: "capture-inbox",
        order: 0,
        column: 3,
        visible: true,
      },
    ]);

    try {
      const saved = await service.saveDashboardLayout(userId, STUDIO_TODAY_PAGE_KEY, custom);
      assert.equal(saved.isDefault, false);
      assert.equal(saved.widgets[0]?.widgetType, "homelab");

      const reloaded = await service.getDashboardLayout(userId, STUDIO_TODAY_PAGE_KEY);
      assert.equal(reloaded.isDefault, false);
      assert.deepEqual(reloaded.widgets, saved.widgets);
    } finally {
      await db.$disconnect();
    }
  });

  it("rejects unknown widget types for a page key", async () => {
    const db = createPrismaClient(databaseUrl);
    const service = createDashboardLayoutService(db);
    try {
      await assert.rejects(
        () =>
          service.saveDashboardLayout(userId, STUDIO_TODAY_PAGE_KEY, [
            {
              id: "bad",
              widgetType: "unknown-widget",
              order: 0,
              column: 1,
              visible: true,
            },
          ]),
        /Unbekannter Widget-Typ/,
      );
    } finally {
      await db.$disconnect();
    }
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
