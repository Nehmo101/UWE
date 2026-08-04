import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAccessContext,
  buildPlayerViewContext,
  canEditContent,
  canPreviewAsPlayer,
  canReadDmSections,
  canViewWorldContent,
  filterBlocksForViewer,
  canSeeUnreleasedPages,
  filterPagesForViewer,
  isDm,
  isOwner,
  redactDmSectionsForViewer,
} from "./permissions";
import type { AreaAccess, AuthUser } from "./types";

function access(partial: Partial<AreaAccess> = {}): AreaAccess {
  return { portal: false, studio: false, brain: false, family: false, ...partial };
}

function user(id: string, overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id,
    displayName: id,
    email: `${id}@test`,
    isOwner: false,
    access: access(),
    aiAccess: false,
    ...overrides,
  };
}

const ownerCtx = buildAccessContext({
  user: user("owner-1", { isOwner: true, access: access({ portal: true, studio: true, brain: true, family: true }) }),
  worldMembership: { userId: "owner-1", worldId: "w1", characterName: null },
});

const dmCtx = buildAccessContext({
  user: user("dm-1", { access: access({ portal: true, studio: true }) }),
  worldMembership: { userId: "dm-1", worldId: "w1", characterName: null },
});

const playerCtx = buildAccessContext({
  user: user("p1", { access: access({ portal: true }) }),
  worldMembership: { userId: "p1", worldId: "w1", characterName: "Aman" },
});

/** Portal checkbox, but not assigned to this world. */
const outsiderCtx = buildAccessContext({
  user: user("out-1", { access: access({ portal: true }) }),
  worldMembership: null,
});

const anonymousCtx = buildAccessContext({ user: null, worldMembership: null });

describe("permissions", () => {
  it("lets everyone assigned to the world see its content", () => {
    // The only content rule left: world assignment. No dm_only, no
    // player_visible, no draft state, no per-page grant.
    assert.ok(canViewWorldContent(ownerCtx));
    assert.ok(canViewWorldContent(dmCtx));
    assert.ok(canViewWorldContent(playerCtx));
  });

  it("gives an unassigned Portal user and an anonymous visitor nothing", () => {
    assert.equal(canViewWorldContent(outsiderCtx), false);
    assert.equal(canViewWorldContent(anonymousCtx), false);
  });

  it("lets the Studio checkbox reach a world without an assignment", () => {
    const studioOutsider = buildAccessContext({
      user: user("dm-2", { access: access({ studio: true }) }),
      worldMembership: null,
    });
    assert.ok(canViewWorldContent(studioOutsider));
  });

  it("makes editing the Studio checkbox, nothing else", () => {
    assert.ok(canEditContent(dmCtx));
    assert.ok(canEditContent(ownerCtx));
    assert.equal(canEditContent(playerCtx), false);
    assert.equal(canEditContent(anonymousCtx), false);
  });

  it("separates the owner from other Studio users", () => {
    assert.ok(isOwner(ownerCtx));
    assert.equal(isOwner(dmCtx), false);
    assert.ok(isDm(ownerCtx));
    assert.ok(isDm(dmCtx));
    assert.equal(isDm(playerCtx), false);
  });

  it("drops Studio rights while previewing as a player", () => {
    const preview = buildAccessContext({
      user: user("dm-1", { access: access({ portal: true, studio: true }) }),
      worldMembership: { userId: "dm-1", worldId: "w1", characterName: null },
      preview: { previewAsUserId: "p1" },
    });
    assert.equal(isDm(preview), false);
    assert.equal(canEditContent(preview), false);
    assert.equal(canPreviewAsPlayer(preview), false);
    // Content stays readable — the preview still belongs to the world.
    assert.ok(canViewWorldContent(preview));
  });

  it("only offers player preview to Studio users", () => {
    assert.ok(canPreviewAsPlayer(dmCtx));
    assert.equal(canPreviewAsPlayer(playerCtx), false);
  });

  it("filters lists by the same single rule", () => {
    const pages = [{ id: "a", portalReleased: true }, { id: "b", portalReleased: true }];
    assert.deepEqual(filterPagesForViewer(playerCtx, pages), pages);
    assert.deepEqual(filterPagesForViewer(outsiderCtx, pages), []);
    assert.deepEqual(filterBlocksForViewer(dmCtx, pages), pages);
    assert.deepEqual(filterBlocksForViewer(anonymousCtx, pages), []);
  });
});

describe("Portal-Freigabe je Seite", () => {
  const frei = { id: "frei", portalReleased: true };
  const gesperrt = { id: "gesperrt", portalReleased: false };
  const pages = [frei, gesperrt];

  it("zeigt einem Spieler nur die freigegebenen Seiten", () => {
    assert.deepEqual(filterPagesForViewer(playerCtx, pages), [frei]);
  });

  it("zeigt dem Studio-Häkchen alles, freigegeben oder nicht", () => {
    assert.deepEqual(filterPagesForViewer(dmCtx, pages), pages);
    assert.deepEqual(filterPagesForViewer(ownerCtx, pages), pages);
  });

  it("nimmt in der Spieler-Vorschau die Freigabe ernst", () => {
    const preview = buildAccessContext({
      user: user("dm-1", { access: access({ portal: true, studio: true }) }),
      worldMembership: { userId: "dm-1", worldId: "w1", characterName: null },
      preview: { previewAsUserId: "p1" },
    });
    assert.equal(canSeeUnreleasedPages(preview), false);
    assert.deepEqual(filterPagesForViewer(preview, pages), [frei]);
  });

  it("hält eine Seite ohne das Feld zurück — fail-closed", () => {
    // Genau der Fall, den eine vergessene `select`-Zeile erzeugt. Die Liste
    // bleibt dann leer; das faellt auf. Die Gegenrichtung faellt nicht auf.
    assert.deepEqual(filterPagesForViewer(playerCtx, [{ id: "ohne-feld" }]), []);
    assert.deepEqual(filterPagesForViewer(playerCtx, [{ id: "x", portalReleased: "ja" }]), []);
  });

  it("lässt die Welt-Zuordnung vorgehen: ohne sie gibt es gar nichts", () => {
    assert.deepEqual(filterPagesForViewer(outsiderCtx, pages), []);
    assert.deepEqual(filterPagesForViewer(anonymousCtx, pages), []);
  });

  it("buildPlayerViewContext ist exakt die Spielersicht", () => {
    // Der Kontext hinter `preview=player` (Studio-Graph-Route, MCP) und dem
    // statischen Export: Welt-Inhalt ja, unfreigegebene Seiten und
    // DM-Bereiche nein.
    const ctx = buildPlayerViewContext("w1");
    assert.ok(canViewWorldContent(ctx));
    assert.equal(canSeeUnreleasedPages(ctx), false);
    assert.equal(canReadDmSections(ctx), false);
    assert.deepEqual(filterPagesForViewer(ctx, pages), [frei]);
  });
});

describe("DM-Bereich im Wikitext", () => {
  const SECRET = "Roderick arbeitet für die Gegenseite.";
  const CONTENT = `Vorlesetext\n:::dm\n${SECRET}\n:::\nNachher`;
  const blocks = () => [{ id: "b1", content: CONTENT }];

  it("liest den Bereich, wer das Studio-Häkchen trägt", () => {
    assert.ok(canReadDmSections(dmCtx));
    assert.deepEqual(filterBlocksForViewer(dmCtx, blocks()), blocks());
  });

  it("lässt den Owner durch", () => {
    assert.ok(canReadDmSections(ownerCtx));

    // Auch ohne Studio-Häkchen: der Owner richtet die Häkchen ein.
    const ownerWithoutStudio = buildAccessContext({
      user: user("owner-2", { isOwner: true, access: access({ portal: true }) }),
      worldMembership: { userId: "owner-2", worldId: "w1", characterName: null },
    });
    assert.ok(canReadDmSections(ownerWithoutStudio));
  });

  it("schneidet ihn für den Spieler heraus — Welt-Zuordnung reicht nicht", () => {
    assert.equal(canReadDmSections(playerCtx), false);

    const filtered = filterBlocksForViewer(playerCtx, blocks());
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].content.includes(SECRET), false);
    assert.equal(filtered[0].content, "Vorlesetext\nNachher");
  });

  it("schneidet ihn auch in der Vorschau als Spieler heraus", () => {
    const preview = buildAccessContext({
      user: user("dm-1", { isOwner: true, access: access({ portal: true, studio: true }) }),
      worldMembership: { userId: "dm-1", worldId: "w1", characterName: null },
      preview: { previewAsUserId: "p1" },
    });

    assert.equal(canReadDmSections(preview), false);
    assert.equal(filterBlocksForViewer(preview, blocks())[0].content.includes(SECRET), false);
  });

  it("lässt Blöcke ohne Marke unverändert durch — dieselbe Liste, dieselben Objekte", () => {
    // Der Normalfall. Wer hier eine Kopie zurückgibt, nimmt dem Suchindex-Cache
    // seinen Identitätsvergleich und alloziert bei jedem Tastendruck neu.
    const plain = [{ id: "b1", content: "Ganz gewöhnlich" }];
    assert.equal(filterBlocksForViewer(playerCtx, plain), plain);
  });

  it("kopiert nur die Blöcke, aus denen wirklich etwas herausfällt", () => {
    const mixed = [
      { id: "b1", content: "Ganz gewöhnlich" },
      { id: "b2", content: CONTENT },
      { id: "b3", content: "Auch gewöhnlich" },
    ];
    const filtered = filterBlocksForViewer(playerCtx, mixed);

    assert.notEqual(filtered, mixed);
    assert.equal(filtered[0], mixed[0]);
    assert.notEqual(filtered[1], mixed[1]);
    assert.equal(filtered[2], mixed[2]);
    assert.equal(filtered[1].content, "Vorlesetext\nNachher");
    assert.equal(filtered.length, 3);
  });

  it("verändert den Ausgangsblock nicht", () => {
    const input = blocks();
    filterBlocksForViewer(playerCtx, input);
    assert.equal(input[0].content, CONTENT);
  });

  it("schneidet auch einzelne Textfelder", () => {
    assert.equal(redactDmSectionsForViewer(playerCtx, CONTENT), "Vorlesetext\nNachher");
    assert.equal(redactDmSectionsForViewer(dmCtx, CONTENT), CONTENT);
    assert.equal(redactDmSectionsForViewer(playerCtx, null), null);
    assert.equal(redactDmSectionsForViewer(playerCtx, undefined), undefined);
  });
});
