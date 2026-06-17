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
  canRevealSecret,
  canUploadMedia,
  canUseAI,
  type WorldAuthTarget,
} from "./authz";
import type { AuthUser, WorldMembership } from "../types";

const ownerUser: AuthUser = {
  id: "owner-1",
  displayName: "Owner",
  email: "owner@test",
  role: "owner",
};

const userA: AuthUser = {
  id: "user-a",
  displayName: "User A",
  email: "a@test",
  role: "player",
};

const playerMembershipA: WorldMembership = {
  userId: "user-a",
  worldId: "world-a",
  role: "player",
  characterName: "Hero A",
};

const playerMembershipB: WorldMembership = {
  userId: "user-b",
  worldId: "world-b",
  role: "player",
  characterName: "Hero B",
};

const worldA: WorldAuthTarget = {
  id: "world-a",
  guestModeEnabled: false,
  membership: playerMembershipA,
};

const worldB: WorldAuthTarget = {
  id: "world-b",
  guestModeEnabled: false,
  membership: playerMembershipB,
};

const publicWorld: WorldAuthTarget = {
  id: "world-public",
  guestModeEnabled: true,
  membership: null,
};

const dmOnlyContent = {
  id: "page-dm",
  visibility: "dm_only",
  publishStatus: "published",
};

const playerVisibleContent = {
  id: "page-player",
  visibility: "player_visible",
  publishStatus: "published",
};

const secretContent = {
  id: "page-secret",
  type: "secret" as const,
  visibility: "dm_only",
  publishStatus: "published",
};

describe("authz — world access", () => {
  it("blocks User A from reading World B (horizontal privilege)", () => {
    const worldBForUserA: WorldAuthTarget = {
      id: "world-b",
      guestModeEnabled: false,
      membership: null,
    };
    assert.equal(canReadWorld(userA, worldBForUserA), false);
    assert.throws(
      () => assertCanReadWorld(userA, worldBForUserA),
      (error: unknown) => error instanceof AuthorizationError && error.statusCode === 403,
    );
  });

  it("allows User A to read their own world", () => {
    assert.equal(canReadWorld(userA, worldA), true);
  });

  it("allows guests to read public worlds only", () => {
    assert.equal(canReadWorld(null, publicWorld), true);
    assert.equal(
      canReadWorld(null, { id: "world-a", guestModeEnabled: false, membership: null }),
      false,
    );
  });

  it("allows OWNER to read everything", () => {
    assert.equal(canReadWorld(ownerUser, worldA), true);
    assert.equal(canReadWorld(ownerUser, worldB), true);
    assert.equal(canReadWorld(ownerUser, publicWorld), true);
  });
});

describe("authz — content access", () => {
  it("blocks PLAYER from reading DM-only content (vertical privilege)", () => {
    assert.equal(canReadContent(userA, dmOnlyContent, worldA), false);
    assert.throws(
      () => assertCanReadContent(userA, dmOnlyContent, worldA),
      (error: unknown) => error instanceof AuthorizationError,
    );
  });

  it("allows PLAYER to read player_visible content", () => {
    assert.equal(canReadContent(userA, playerVisibleContent, worldA), true);
  });

  it("blocks direct ID lookup on private resource in foreign world", () => {
    const foreignWorld: WorldAuthTarget = {
      id: "world-b",
      guestModeEnabled: false,
      membership: null,
    };
    assert.equal(canReadContent(userA, playerVisibleContent, foreignWorld), false);
  });

  it("denies unknown visibility (deny-by-default)", () => {
    assert.equal(
      canReadContent(userA, { id: "x", visibility: "unknown_vis", publishStatus: "published" }, worldA),
      false,
    );
  });

  it("denies unknown publish status (deny-by-default)", () => {
    assert.equal(
      canReadContent(userA, { id: "x", visibility: "player_visible", publishStatus: "unknown_status" }, worldA),
      false,
    );
  });

  it("allows OWNER to read all content including DM-only", () => {
    assert.equal(canReadContent(ownerUser, dmOnlyContent, worldA), true);
    assert.equal(canReadContent(ownerUser, secretContent, worldA), true);
  });
});

describe("authz — edit access", () => {
  it("blocks PLAYER from editing content", () => {
    assert.equal(canEditContent(userA, playerVisibleContent, worldA), false);
    assert.throws(
      () => assertCanEditContent(userA, playerVisibleContent, worldA),
      (error: unknown) => error instanceof AuthorizationError,
    );
  });

  it("blocks editing content in foreign/private world", () => {
    assert.equal(canEditContent(userA, playerVisibleContent, worldB), false);
    assert.equal(canEditWorld(userA, worldB), false);
  });

  it("allows OWNER to edit everything", () => {
    assert.equal(canEditWorld(ownerUser, worldB), true);
    assert.equal(canEditContent(ownerUser, dmOnlyContent, worldA), true);
  });
});

describe("authz — secrets", () => {
  it("blocks PLAYER from revealing secrets", () => {
    assert.equal(canRevealSecret(userA, secretContent, worldA), false);
  });

  it("allows OWNER to reveal secrets", () => {
    assert.equal(canRevealSecret(ownerUser, secretContent, worldA), true);
  });
});

describe("authz — media and AI", () => {
  it("blocks PLAYER from uploading media", () => {
    assert.equal(
      canUploadMedia(userA, { worldId: "world-a", membership: playerMembershipA }),
      false,
    );
  });

  it("allows OWNER to upload media and use AI", () => {
    assert.equal(
      canUploadMedia(ownerUser, { worldId: "world-a", membership: null }),
      true,
    );
    assert.equal(canUseAI(ownerUser, { worldId: "world-a" }), true);
  });

  it("blocks PLAYER from using AI with brain data", () => {
    assert.equal(
      canUseAI(userA, { worldId: "world-a", membership: playerMembershipA, includesBrainData: true }),
      false,
    );
  });

  it("allows studio trusted mode without user", () => {
    assert.equal(canReadWorld(null, worldA, { studioTrusted: true }), true);
    assert.equal(canEditWorld(null, worldA, { studioTrusted: true }), true);
    assert.equal(canUploadMedia(null, { worldId: "world-a" }, { studioTrusted: true }), true);
  });
});
