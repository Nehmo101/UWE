import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AuthRequiredError,
  ForbiddenAccessError,
  canAccessBrain,
  canAccessFamily,
  canAccessPortal,
  canAccessStudio,
  getRequiredAccessForApiPath,
  getRequiredAccessForPagePath,
  isOwner,
  requireArea,
  requireOwner,
  requireUser,
  satisfiesStudioRouteAccess,
  toAreaAccess,
} from "./area-access";
import { NO_AREA_ACCESS, type AuthUser } from "./types";

function user(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "u1",
    displayName: "Test",
    email: "test@uwe.local",
    isOwner: false,
    access: { ...NO_AREA_ACCESS },
    ...overrides,
  };
}

const owner = user({
  id: "owner",
  isOwner: true,
  access: { portal: true, studio: true, brain: true, family: true },
});
const dm = user({ id: "dm", access: { ...NO_AREA_ACCESS, portal: true, studio: true } });
const player = user({ id: "player", access: { ...NO_AREA_ACCESS, portal: true } });
const nobody = user({ id: "nobody" });

describe("area access", () => {
  it("answers each area from its own checkbox", () => {
    assert.ok(canAccessPortal(player));
    assert.equal(canAccessStudio(player), false);
    assert.equal(canAccessBrain(player), false);
    assert.equal(canAccessFamily(player), false);

    assert.ok(canAccessStudio(dm));
    assert.equal(canAccessBrain(dm), false);

    assert.ok(canAccessBrain(owner));
    assert.ok(canAccessFamily(owner));
  });

  it("keeps owner separate from the four checkboxes", () => {
    assert.ok(isOwner(owner));
    assert.equal(isOwner(dm), false);
    // Ticking every box does not make someone the owner.
    const fullAccess = user({ access: { portal: true, studio: true, brain: true, family: true } });
    assert.equal(isOwner(fullAccess), false);
  });

  it("throws the right error for anonymous vs. unticked", () => {
    assert.throws(() => requireUser(null), AuthRequiredError);
    assert.throws(() => requireArea(nobody, "studio"), ForbiddenAccessError);
    assert.throws(() => requireOwner(dm), ForbiddenAccessError);
    assert.equal(requireArea(dm, "studio"), dm);
    assert.equal(requireOwner(owner), owner);
  });

  it("maps Studio routes to the access they need", () => {
    assert.equal(getRequiredAccessForApiPath("/api/health"), null);
    assert.equal(getRequiredAccessForApiPath("/api/auth/login"), null);
    assert.equal(getRequiredAccessForApiPath("/worlds"), null);
    assert.equal(getRequiredAccessForApiPath("/api/worlds"), "studio");
    assert.equal(getRequiredAccessForApiPath("/api/admin/users"), "owner");

    assert.equal(getRequiredAccessForPagePath("/worlds"), "studio");
    assert.equal(getRequiredAccessForPagePath("/admin/users"), "owner");
    assert.equal(getRequiredAccessForPagePath("/ideas"), "owner");
  });

  it("checks a user against a route requirement", () => {
    assert.ok(satisfiesStudioRouteAccess(player, "public"));
    assert.equal(satisfiesStudioRouteAccess(player, "studio"), false);
    assert.ok(satisfiesStudioRouteAccess(dm, "studio"));
    assert.equal(satisfiesStudioRouteAccess(dm, "owner"), false);
    assert.ok(satisfiesStudioRouteAccess(owner, "owner"));
  });

  it("builds an access record from loose DB booleans", () => {
    assert.deepEqual(toAreaAccess({ portalAccess: true, brainAccess: null }), {
      portal: true,
      studio: false,
      brain: false,
      family: false,
    });
  });
});
