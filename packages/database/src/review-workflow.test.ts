import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAccessContext, canEditContentRole, canViewPage, isCoDm, isWorldStaff } from "@uwe/auth";
import { createPrismaClient } from "./client";
import { createReviewService } from "./review-service";
import { resolveReview } from "./review-bridge";
import { createTestDatabaseUrl } from "./test-helpers";

describe("review workflow", () => {
  it("creates and approves a player note review", async () => {
    const db = createPrismaClient(createTestDatabaseUrl());
    try {
      const world = await db.world.create({
        data: { name: "Review World", slug: "review-world" },
      });
      const campaign = await db.campaign.create({
        data: { name: "C1", slug: "c1", worldId: world.id },
      });
      const reviewer = await db.user.create({
        data: { displayName: "DM", role: "dm" },
      });
      const player = await db.user.create({
        data: { displayName: "Player", role: "player" },
      });
      const note = await db.playerNote.create({
        data: {
          worldId: world.id,
          campaignId: campaign.id,
          userId: player.id,
          content: "Ich habe den Drachen gesehen.",
          status: "visible_to_dm",
          visibility: "dm_only",
        },
      });

      const reviews = createReviewService(db);
      const pending = await reviews.upsertPending({
        worldId: world.id,
        sourceType: "player_note",
        sourceId: note.id,
        title: "Spielernotiz",
        summary: note.content,
        proposedByUserId: player.id,
      });
      assert.equal(pending.status, "pending");

      const result = await resolveReview(db, pending.id, reviewer.id);
      assert.equal(result.ok, true);

      const updatedNote = await db.playerNote.findUnique({ where: { id: note.id } });
      assert.equal(updatedNote?.status, "accepted");

      const approved = await reviews.getById(pending.id);
      assert.equal(approved?.status, "approved");

      const activity = await db.activityLog.findFirst({
        where: { action: "review_approved", targetId: pending.id },
      });
      assert.ok(activity);
    } finally {
      await db.$disconnect();
    }
  });

  it("rejects a review with reason and logs activity", async () => {
    const db = createPrismaClient(createTestDatabaseUrl());
    try {
      const world = await db.world.create({
        data: { name: "Reject World", slug: "reject-world" },
      });
      const reviewer = await db.user.create({
        data: { displayName: "Owner", role: "owner" },
      });
      const reviews = createReviewService(db);
      const pending = await reviews.upsertPending({
        worldId: world.id,
        sourceType: "co_dm_change",
        sourceId: "test-change-1",
        title: "NPC umbenennen",
        summary: "Vorschlag",
      });

      const rejected = await reviews.reject({
        reviewId: pending.id,
        reviewerUserId: reviewer.id,
        reason: "Passt nicht zum Kanon",
      });
      assert.equal(rejected.status, "rejected");
      assert.equal(rejected.rejectReason, "Passt nicht zum Kanon");

      const comment = await reviews.addComment({
        reviewId: pending.id,
        userId: reviewer.id,
        content: "Bitte neu formulieren.",
      });
      assert.equal(comment.content, "Bitte neu formulieren.");
    } finally {
      await db.$disconnect();
    }
  });
});

describe("co_dm permissions", () => {
  it("co_dm can view dm_only pages but not edit", () => {
    const ctx = buildAccessContext({
      user: { id: "u1", displayName: "Co", email: null, role: "player" },
      worldMembership: {
        userId: "u1",
        worldId: "w1",
        role: "co_dm",
        characterName: null,
      },
      guestModeEnabled: false,
    });

    assert.equal(isCoDm(ctx), true);
    assert.equal(isWorldStaff(ctx), true);
    assert.equal(canEditContentRole(ctx), false);
    assert.equal(
      canViewPage(ctx, {
        id: "p1",
        visibility: "dm_only",
        publishStatus: "published",
      }),
      true,
    );
  });
});
