import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  auditNavigation,
  auditStudioNavigation,
  collectAppRoutePatterns,
  matchesRoutePattern,
} from "./inspect-navigation";
import { studioNavItems } from "./studio-nav";
import type { NavItem } from "./types";

function navItem(partial: Partial<NavItem> & Pick<NavItem, "id" | "href" | "status">): NavItem {
  return {
    label: partial.label ?? partial.id,
    icon: "x",
    group: "G",
    section: "S",
    permission: ["owner"],
    source: "studio",
    keywords: [],
    ...partial,
  } as NavItem;
}

describe("route pattern matching", () => {
  it("matches dynamic segments", () => {
    assert.equal(matchesRoutePattern("/worlds/terra/dashboard", "/worlds/[worldSlug]/dashboard"), true);
    assert.equal(matchesRoutePattern("/worlds/terra", "/worlds/[worldSlug]/dashboard"), false);
    assert.equal(matchesRoutePattern("/worlds", "/worlds"), true);
    assert.equal(matchesRoutePattern("/worlds/x", "/worlds"), false);
  });
});

describe("auditNavigation (pure)", () => {
  const routes = ["/worlds", "/search", "/admin", "/admin/activity"];

  it("flags active items without a route as dead links", () => {
    const items = [
      navItem({ id: "ok", href: "/worlds", status: "active" }),
      navItem({ id: "dead", href: "/nope", status: "active" }),
    ];
    const audit = auditNavigation(items, routes);
    assert.deepEqual(audit.deadLinks.map((e) => e.id), ["dead"]);
  });

  it("flags planned items that now have a route as promotable", () => {
    const items = [navItem({ id: "ver", href: "/admin/activity", status: "planned" })];
    const audit = auditNavigation(items, routes);
    assert.deepEqual(audit.promotable.map((e) => e.id), ["ver"]);
  });

  it("lists routes not referenced by navigation", () => {
    const items = [navItem({ id: "a", href: "/worlds", status: "active" })];
    const audit = auditNavigation(items, routes);
    assert.ok(audit.routesWithoutNav.includes("/search"));
    assert.ok(!audit.routesWithoutNav.includes("/worlds"));
  });
});

describe("collectAppRoutePatterns (fs)", () => {
  it("collects real Studio routes, excludes /api, keeps [param]", () => {
    const patterns = collectAppRoutePatterns();
    assert.ok(patterns.includes("/worlds"), "expected /worlds");
    assert.ok(patterns.includes("/worlds/[worldSlug]/dashboard"), "expected dynamic world route");
    assert.ok(!patterns.some((p) => p.startsWith("/api")), "should exclude api routes");
  });

  it("the live Studio IA has no dead links against the route tree", () => {
    const audit = auditStudioNavigation(studioNavItems());
    assert.deepEqual(
      audit.deadLinks.map((e) => `${e.id} -> ${e.href}`),
      [],
      "active Studio nav items must map to real routes",
    );
  });
});
