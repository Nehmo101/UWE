import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  createCharacterService,
  createPartyTreasuryService,
  type PartyTreasuryService,
} from "@uwe/database/server";
import type { AccessContext } from "@uwe/auth";
import { PRIVATE_LEAK_MARKERS, SECURITY_MARKERS } from "./markers";
import { createSecurityFixture, type SecurityFixture } from "./fixtures/security-fixture";

/**
 * Treasury-Authz: Der Gruppenschatz ist Spieler-Inhalt (wie player_visible).
 * dm_only-Items (properties.dmOnly), DM-Notizen (properties.dmNotes) und Items
 * mit nicht sichtbarer verlinkter Seite dürfen nie im Portal landen. Spieler
 * bewegen Items nur zwischen Schatzkammer und EIGENEM Charakter.
 */
describe("treasury authorization and player-safe filtering", () => {
  let fixture: SecurityFixture;
  let treasury: PartyTreasuryService;
  let publicWorldId: string;
  let privateWorldId: string;
  let playerCharacterId: string;
  let dmCharacterId: string;
  let safeItemId: string;
  let notesItemId: string;
  let dmOnlyItemId: string;
  let hiddenArtifactItemId: string;
  let dmCarriedItemId: string;

  async function contextFor(
    worldSlug: string,
    userId?: string,
    previewAsUserId?: string,
  ): Promise<AccessContext> {
    const ctx = await fixture.auth.buildAccessContextForWorld(worldSlug, {
      userId,
      preview: previewAsUserId ? { previewAsUserId } : undefined,
    });
    assert.ok(ctx, `expected access context for ${worldSlug}`);
    return ctx;
  }

  before(async () => {
    fixture = await createSecurityFixture();
    treasury = createPartyTreasuryService(fixture.db);

    const publicWorld = await fixture.db.world.findUniqueOrThrow({
      where: { slug: fixture.content.publicWorldSlug },
      select: { id: true },
    });
    publicWorldId = publicWorld.id;

    const privateWorld = await fixture.db.world.findUniqueOrThrow({
      where: { slug: fixture.content.privateWorldSlug },
      select: { id: true },
    });
    privateWorldId = privateWorld.id;

    const publicTreasury = await treasury.getOrCreateForWorld(publicWorldId);
    await treasury.upsert({
      worldId: publicWorldId,
      currencies: { cp: 0, sp: 0, ep: 0, gp: 100, pp: 0 },
      notes: "Gruppenkasse",
    });

    const safeItem = await treasury.addItem({
      worldId: publicWorldId,
      treasuryId: publicTreasury.id,
      name: "Heiltrank",
      notes: SECURITY_MARKERS.PLAYER_VISIBLE,
    });
    safeItemId = safeItem.id;

    // Sichtbares Item mit DM-Notizen in properties — Notizen dürfen nicht leaken.
    const notesItem = await treasury.addItem({
      worldId: publicWorldId,
      treasuryId: publicTreasury.id,
      name: "Seil",
      properties: { dmNotes: SECURITY_MARKERS.DM_ONLY },
    });
    notesItemId = notesItem.id;

    // dm_only-Item (verstecktes Artefakt per Flag).
    const dmOnlyItem = await treasury.addItem({
      worldId: publicWorldId,
      treasuryId: publicTreasury.id,
      name: `Verstecktes Artefakt ${SECURITY_MARKERS.DM_ONLY}`,
      properties: { dmOnly: true, dmNotes: SECURITY_MARKERS.DM_ONLY },
    });
    dmOnlyItemId = dmOnlyItem.id;

    // Item, das auf eine dm_only-Seite verlinkt (verstecktes Artefakt per Seite).
    const dmOnlyPage = await fixture.db.page.findFirstOrThrow({
      where: {
        slug: fixture.content.slugs.dmOnlyPage,
        world: { slug: fixture.content.publicWorldSlug },
      },
      select: { id: true },
    });
    const hiddenArtifactItem = await treasury.addItem({
      worldId: publicWorldId,
      treasuryId: publicTreasury.id,
      name: `Artefakt der Geheimnisse ${SECURITY_MARKERS.DM_ONLY}`,
      pageId: dmOnlyPage.id,
    });
    hiddenArtifactItemId = hiddenArtifactItem.id;

    // Guest-disabled Welt mit DM-Schatz.
    const privateTreasury = await treasury.getOrCreateForWorld(privateWorldId);
    await treasury.addItem({
      worldId: privateWorldId,
      treasuryId: privateTreasury.id,
      name: `Geheimschatz ${SECURITY_MARKERS.DM_ONLY}`,
    });

    const characters = createCharacterService(fixture.db);
    const playerCharacter = await characters.create({
      worldId: publicWorldId,
      ownerUserId: fixture.users.player.id,
      displayName: "Testheld",
    });
    playerCharacterId = playerCharacter.id;

    const dmCharacter = await characters.create({
      worldId: publicWorldId,
      ownerUserId: fixture.users.dm.id,
      displayName: "DM-Begleiter",
    });
    dmCharacterId = dmCharacter.id;

    // Item, das bereits ein fremder Charakter trägt.
    const dmCarriedItem = await treasury.addItem({
      worldId: publicWorldId,
      characterId: dmCharacterId,
      name: "Fremder Dolch",
    });
    dmCarriedItemId = dmCarriedItem.id;
  });

  after(async () => {
    await fixture.cleanup();
  });

  describe("getForViewer", () => {
    it("hides dm-only items, hidden artifacts, and dm notes from players", async () => {
      const ctx = await contextFor(fixture.content.publicWorldSlug, fixture.users.player.id);
      const view = await treasury.getForViewer(fixture.content.publicWorldSlug, ctx);
      assert.ok(view);

      const names = view.items.map((item) => item.name);
      assert.ok(names.includes("Heiltrank"));
      assert.ok(names.includes("Seil"));
      assert.equal(view.items.length, 2);

      const serialized = JSON.stringify(view);
      for (const marker of PRIVATE_LEAK_MARKERS) {
        assert.ok(!serialized.includes(marker), `treasury view leaked marker ${marker}`);
      }
      assert.ok(serialized.includes(SECURITY_MARKERS.PLAYER_VISIBLE));
    });

    it("denies anonymous guests even on guest-enabled worlds", async () => {
      const ctx = await contextFor(fixture.content.publicWorldSlug);
      assert.equal(await treasury.getForViewer(fixture.content.publicWorldSlug, ctx), null);
    });

    it("denies non-member players on guest-disabled worlds", async () => {
      const ctx = await contextFor(fixture.content.privateWorldSlug, fixture.users.player.id);
      assert.equal(await treasury.getForViewer(fixture.content.privateWorldSlug, ctx), null);
    });

    it("shows the dm every item including dm-only entries", async () => {
      const ctx = await contextFor(fixture.content.publicWorldSlug, fixture.users.dm.id);
      const view = await treasury.getForViewer(fixture.content.publicWorldSlug, ctx);
      assert.ok(view);
      assert.equal(view.items.length, 4);
      assert.ok(view.items.some((item) => item.dmOnly));
    });

    it("filters the dm preview session like a real player", async () => {
      const ctx = await contextFor(
        fixture.content.publicWorldSlug,
        fixture.users.dm.id,
        fixture.users.player.id,
      );
      const view = await treasury.getForViewer(fixture.content.publicWorldSlug, ctx);
      assert.ok(view);
      assert.equal(view.items.length, 2);

      const serialized = JSON.stringify(view);
      for (const marker of PRIVATE_LEAK_MARKERS) {
        assert.ok(!serialized.includes(marker), `preview view leaked marker ${marker}`);
      }
    });
  });

  describe("listItemsForCharacterForViewer", () => {
    it("denies players access to foreign character inventories", async () => {
      const ctx = await contextFor(fixture.content.publicWorldSlug, fixture.users.player.id);
      assert.equal(
        await treasury.listItemsForCharacterForViewer(
          fixture.content.publicWorldSlug,
          dmCharacterId,
          ctx,
        ),
        null,
      );
    });

    it("hides dm-only items from the owning player but not from staff", async () => {
      // DM steckt das dm_only-Item in das Inventar des Spieler-Charakters.
      await treasury.moveItemToCharacter(publicWorldId, dmOnlyItemId, playerCharacterId);

      const playerCtx = await contextFor(fixture.content.publicWorldSlug, fixture.users.player.id);
      const playerItems = await treasury.listItemsForCharacterForViewer(
        fixture.content.publicWorldSlug,
        playerCharacterId,
        playerCtx,
      );
      assert.ok(playerItems);
      assert.equal(playerItems.length, 0);
      const serialized = JSON.stringify(playerItems);
      for (const marker of PRIVATE_LEAK_MARKERS) {
        assert.ok(!serialized.includes(marker), `character inventory leaked marker ${marker}`);
      }

      const dmCtx = await contextFor(fixture.content.publicWorldSlug, fixture.users.dm.id);
      const dmItems = await treasury.listItemsForCharacterForViewer(
        fixture.content.publicWorldSlug,
        playerCharacterId,
        dmCtx,
      );
      assert.ok(dmItems);
      assert.equal(dmItems.length, 1);

      // Aufräumen: zurück in die Schatzkammer (DM-Pfad).
      await treasury.moveItemToTreasury(publicWorldId, dmOnlyItemId);
    });
  });

  describe("moveItemForViewer", () => {
    it("lets a player take a safe treasury item into their own character inventory", async () => {
      const ctx = await contextFor(fixture.content.publicWorldSlug, fixture.users.player.id);
      const moved = await treasury.moveItemForViewer(fixture.content.publicWorldSlug, ctx, {
        itemId: safeItemId,
        targetCharacterId: playerCharacterId,
      });
      assert.ok(moved);
      assert.equal(moved.characterId, playerCharacterId);
      assert.equal(moved.treasuryId, null);
    });

    it("lets a player return their own item to the treasury", async () => {
      const ctx = await contextFor(fixture.content.publicWorldSlug, fixture.users.player.id);
      const moved = await treasury.moveItemForViewer(fixture.content.publicWorldSlug, ctx, {
        itemId: safeItemId,
        targetCharacterId: null,
      });
      assert.ok(moved);
      assert.equal(moved.characterId, null);
      assert.ok(moved.treasuryId);
    });

    it("denies assigning treasury items to a foreign character", async () => {
      const ctx = await contextFor(fixture.content.publicWorldSlug, fixture.users.player.id);
      assert.equal(
        await treasury.moveItemForViewer(fixture.content.publicWorldSlug, ctx, {
          itemId: safeItemId,
          targetCharacterId: dmCharacterId,
        }),
        null,
      );
    });

    it("denies players taking dm-only items", async () => {
      const ctx = await contextFor(fixture.content.publicWorldSlug, fixture.users.player.id);
      assert.equal(
        await treasury.moveItemForViewer(fixture.content.publicWorldSlug, ctx, {
          itemId: dmOnlyItemId,
          targetCharacterId: playerCharacterId,
        }),
        null,
      );
    });

    it("denies players taking hidden artifacts linked to dm-only pages", async () => {
      const ctx = await contextFor(fixture.content.publicWorldSlug, fixture.users.player.id);
      assert.equal(
        await treasury.moveItemForViewer(fixture.content.publicWorldSlug, ctx, {
          itemId: hiddenArtifactItemId,
          targetCharacterId: playerCharacterId,
        }),
        null,
      );
    });

    it("denies players returning items carried by a foreign character", async () => {
      const ctx = await contextFor(fixture.content.publicWorldSlug, fixture.users.player.id);
      assert.equal(
        await treasury.moveItemForViewer(fixture.content.publicWorldSlug, ctx, {
          itemId: dmCarriedItemId,
          targetCharacterId: null,
        }),
        null,
      );
    });

    it("denies anonymous, staff, and preview sessions", async () => {
      const anonymousCtx = await contextFor(fixture.content.publicWorldSlug);
      assert.equal(
        await treasury.moveItemForViewer(fixture.content.publicWorldSlug, anonymousCtx, {
          itemId: safeItemId,
          targetCharacterId: playerCharacterId,
        }),
        null,
      );

      const dmCtx = await contextFor(fixture.content.publicWorldSlug, fixture.users.dm.id);
      assert.equal(
        await treasury.moveItemForViewer(fixture.content.publicWorldSlug, dmCtx, {
          itemId: safeItemId,
          targetCharacterId: dmCharacterId,
        }),
        null,
      );

      const previewCtx = await contextFor(
        fixture.content.publicWorldSlug,
        fixture.users.dm.id,
        fixture.users.player.id,
      );
      assert.equal(
        await treasury.moveItemForViewer(fixture.content.publicWorldSlug, previewCtx, {
          itemId: safeItemId,
          targetCharacterId: playerCharacterId,
        }),
        null,
      );
    });

    it("keeps the dm studio path working for any character", async () => {
      const moved = await treasury.moveItemToCharacter(publicWorldId, notesItemId, dmCharacterId);
      assert.equal(moved.characterId, dmCharacterId);
      assert.equal(moved.treasuryId, null);

      const returned = await treasury.moveItemToTreasury(publicWorldId, notesItemId);
      assert.equal(returned.characterId, null);
      assert.ok(returned.treasuryId);
    });
  });
});
