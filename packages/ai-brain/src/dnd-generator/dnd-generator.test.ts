import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDndGeneratorView,
  buildPageContext,
  buildSessionContext,
  checkPlayerSafeOutput,
  detectMissingContent,
  listActionsForContext,
  runCanonConflictChecks,
  buildPrepareNextSessionOutline,
  serializePrepareNextSessionOutline,
} from "./index";

describe("DnD Generator — context", () => {
  it("maps page types to context kinds", () => {
    const npc = buildPageContext({
      worldSlug: "terra",
      pageSlug: "magister",
      pageType: "npc",
      title: "Magister",
    });
    assert.equal(npc.kind, "npc");

    const session = buildSessionContext({
      worldSlug: "terra",
      sessionId: "sess-1",
      title: "Session 12",
    });
    assert.equal(session.kind, "session");
  });

  it("offers different actions per context", () => {
    const npcActions = listActionsForContext(
      buildPageContext({
        worldSlug: "terra",
        pageSlug: "npc-1",
        pageType: "npc",
        title: "NPC",
      }),
    );
    const sessionActions = listActionsForContext(
      buildSessionContext({ worldSlug: "terra", sessionId: "s1", title: "S1" }),
    );

    assert.ok(npcActions.some((a) => a.id === "image_prompt"));
    assert.ok(npcActions.some((a) => a.id === "create_knowledge_text"));
    assert.ok(sessionActions.some((a) => a.id === "prepare_next_session"));
    assert.ok(!npcActions.some((a) => a.id === "prepare_next_session"));
  });
});

describe("DnD Generator — missing content", () => {
  it("detects NPC without motivation", () => {
    const hints = detectMissingContent(
      buildPageContext({
        worldSlug: "terra",
        pageSlug: "npc-1",
        pageType: "npc",
        title: "NPC",
      }),
      { motivation: "" },
    );
    assert.ok(hints.some((h) => h.field === "motivation"));
  });

  it("detects session without open plots", () => {
    const hints = detectMissingContent(
      buildSessionContext({ worldSlug: "terra", sessionId: "s1", title: "S1" }),
      { openPlots: null },
    );
    assert.ok(hints.some((h) => h.field === "openPlots"));
  });
});

describe("DnD Generator — canon rules", () => {
  it("flags Terra round tower conflicts", () => {
    const conflicts = runCanonConflictChecks({
      worldSlug: "terra",
      context: buildPageContext({
        worldSlug: "terra",
        pageSlug: "turm-ebene",
        pageType: "dungeon_level",
        title: "Magister Turm Ebene 3",
      }),
      pageTitle: "Magister Turm — eckige Ebene",
      pageContent: "Die quadratische Ebene des Turms...",
    });
    assert.ok(conflicts.some((c) => c.code === "terra_round_tower"));
  });

  it("does not apply Terra rules to other worlds", () => {
    const conflicts = runCanonConflictChecks({
      worldSlug: "other-world",
      context: buildPageContext({
        worldSlug: "other-world",
        pageSlug: "tower",
        pageType: "dungeon_level",
        title: "Square Tower Level",
      }),
      pageContent: "quadratische Ebene",
    });
    assert.equal(conflicts.filter((c) => c.code.startsWith("terra")).length, 0);
  });
});

describe("DnD Generator — player safe", () => {
  it("flags DM-only markers in player text", () => {
    const result = checkPlayerSafeOutput("Die Helden betreten den Turm. DM-only: Geheimnis!");
    assert.equal(result.safe, false);
    assert.ok(result.issues.length > 0);
  });

  it("accepts clean player text", () => {
    const result = checkPlayerSafeOutput("Die Helden kehren nach Arbor zurück.");
    assert.equal(result.safe, true);
  });
});

describe("DnD Generator — prepare next session", () => {
  it("builds structured outline as review proposal text", () => {
    const outline = buildPrepareNextSessionOutline({
      worldSlug: "terra",
      lastSessionTitle: "Session 11",
      summaryDm: "Die Gruppe erreichte den Turm.",
      openPlots: "Nepurga wacht\nMagister-Rätsel offen",
      linkedPageTitles: ["Magister NPC", "Nepurga Turm"],
    });

    const text = serializePrepareNextSessionOutline(outline);
    assert.ok(text.includes("Offene Plots"));
    assert.ok(text.includes("Kanon-Warnungen"));
    assert.ok(outline.canonWarnings.some((w) => w.includes("Terra")));
  });
});

describe("DnD Generator — view assembly", () => {
  it("assembles full generator view with review requirement", () => {
    const view = buildDndGeneratorView({
      context: buildPageContext({
        worldSlug: "terra",
        pageSlug: "raum-1",
        pageType: "room",
        title: "Leerer Raum",
      }),
      content: { description: "", dmNotes: "" },
      canonicalStatus: "canon",
    });

    assert.ok(view.missingContent.length > 0);
    assert.ok(view.actions.every((a) => a.requiresReview));
    assert.ok(view.canonConflicts.some((c) => c.code === "canon_overwrite_risk"));
  });
});
