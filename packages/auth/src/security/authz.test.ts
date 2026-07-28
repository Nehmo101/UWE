import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AuthorizationError,
  assertCanEditContent,
  assertCanReadContent,
  assertCanReadWorld,
  canEditContent,
  canEditWorld,
  canReadContent,
  canReadWorld,
  canUploadMedia,
  canUseAI,
  type WorldAuthTarget,
} from "./authz";
import { NO_AREA_ACCESS, type AuthUser, type WorldMembership } from "../types";

const ownerUser: AuthUser = {
  id: "owner-1",
  displayName: "Owner",
  email: "owner@test",
  isOwner: true,
  access: { portal: true, studio: true, brain: true, family: true },
};

/** Portal checkbox only — a player. */
const userA: AuthUser = {
  id: "user-a",
  displayName: "User A",
  email: "a@test",
  isOwner: false,
  access: { ...NO_AREA_ACCESS, portal: true },
};

/** Studio checkbox, no world assignment anywhere — a DM. */
const dmUser: AuthUser = {
  id: "dm-1",
  displayName: "DM",
  email: "dm@test",
  isOwner: false,
  access: { ...NO_AREA_ACCESS, portal: true, studio: true },
};

const membershipA: WorldMembership = {
  userId: "user-a",
  worldId: "world-a",
  characterName: "Hero A",
};

const membershipB: WorldMembership = {
  userId: "user-b",
  worldId: "world-b",
  characterName: "Hero B",
};

const worldA: WorldAuthTarget = { id: "world-a", membership: membershipA };
const worldB: WorldAuthTarget = { id: "world-b", membership: membershipB };

const somePage = { id: "page-1" };
const otherPage = { id: "page-2" };

describe("authz — world access", () => {
  it("blocks User A from reading World B (horizontal privilege)", () => {
    const worldBForUserA: WorldAuthTarget = { id: "world-b", membership: null };
    assert.equal(canReadWorld(userA, worldBForUserA), false);
    assert.throws(
      () => assertCanReadWorld(userA, worldBForUserA),
      (error: unknown) => error instanceof AuthorizationError && error.statusCode === 403,
    );
  });

  it("allows User A to read their own world", () => {
    assert.equal(canReadWorld(userA, worldA), true);
  });

  it("gives an anonymous visitor nothing — guest mode is gone", () => {
    assert.equal(canReadWorld(null, { id: "world-a", membership: null }), false);
    assert.equal(canReadWorld(null, worldA), false);
  });

  it("lets the Studio checkbox reach every world without an assignment", () => {
    assert.equal(canReadWorld(dmUser, { id: "world-a", membership: null }), true);
    assert.equal(canReadWorld(dmUser, { id: "world-b", membership: null }), true);
  });

  it("allows OWNER to read everything", () => {
    assert.equal(canReadWorld(ownerUser, worldA), true);
    assert.equal(canReadWorld(ownerUser, worldB), true);
  });
});

describe("authz — content access", () => {
  it("lets a world member read every page of that world", () => {
    assert.equal(canReadContent(userA, somePage, worldA), true);
    assert.equal(canReadContent(userA, otherPage, worldA), true);
  });

  it("blocks an anonymous visitor", () => {
    assert.equal(canReadContent(null, somePage, worldA), false);
    assert.throws(
      () => assertCanReadContent(null, somePage, worldA),
      (error: unknown) => error instanceof AuthorizationError,
    );
  });

  it("blocks direct ID lookup on a resource in a foreign world", () => {
    const foreignWorld: WorldAuthTarget = { id: "world-b", membership: null };
    assert.equal(canReadContent(userA, otherPage, foreignWorld), false);
  });

  it("allows OWNER to read content in every world", () => {
    assert.equal(canReadContent(ownerUser, somePage, worldA), true);
    assert.equal(canReadContent(ownerUser, somePage, worldB), true);
  });
});

describe("authz — edit access", () => {
  it("blocks a Portal-only member from editing content in their own world", () => {
    assert.equal(canEditContent(userA, otherPage, worldA), false);
    assert.throws(
      () => assertCanEditContent(userA, otherPage, worldA),
      (error: unknown) => error instanceof AuthorizationError,
    );
  });

  it("blocks editing content in a foreign world", () => {
    assert.equal(canEditContent(userA, otherPage, worldB), false);
    assert.equal(canEditWorld(userA, worldB), false);
  });

  it("lets the Studio checkbox edit, and the owner edit everything", () => {
    assert.equal(canEditWorld(dmUser, worldB), true);
    assert.equal(canEditContent(dmUser, somePage, worldA), true);
    assert.equal(canEditWorld(ownerUser, worldB), true);
    assert.equal(canEditContent(ownerUser, somePage, worldA), true);
  });
});

describe("authz — media and AI", () => {
  it("blocks a Portal-only member from uploading media and using AI", () => {
    assert.equal(
      canUploadMedia(userA, { worldId: "world-a", membership: membershipA }),
      false,
    );
    assert.equal(canUseAI(userA, { worldId: "world-a", membership: membershipA }), false);
  });

  it("allows Studio and OWNER to upload media and use AI", () => {
    assert.equal(canUploadMedia(dmUser, { worldId: "world-a", membership: null }), true);
    assert.equal(canUseAI(dmUser, { worldId: "world-a" }), true);
    assert.equal(canUploadMedia(ownerUser, { worldId: "world-a", membership: null }), true);
    assert.equal(canUseAI(ownerUser, { worldId: "world-a" }), true);
  });

  it("allows studio trusted mode without user", () => {
    assert.equal(canReadWorld(null, worldA, { studioTrusted: true }), true);
    assert.equal(canEditWorld(null, worldA, { studioTrusted: true }), true);
    assert.equal(canUploadMedia(null, { worldId: "world-a" }, { studioTrusted: true }), true);
  });
});
