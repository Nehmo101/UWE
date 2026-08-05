import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCampaignAiDigest } from "./campaign-ai-digest";
import type { CampaignOverview } from "./cockpit-service";

function overview(partial: Partial<CampaignOverview>): CampaignOverview {
  return {
    campaign: {
      id: "camp-1",
      worldId: "world-1",
      name: "Himmelsrouten",
      slug: "himmelsrouten",
      description: "Handelsrouten im Wolkenmeer.",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    },
    worldId: "world-1",
    chapters: [],
    unassignedQuests: [],
    factions: [],
    lastSession: null,
    nextSession: null,
    recentEvents: [],
    noteQueueCount: 0,
    canonConflicts: 0,
    progress: { played: 0, total: 0, label: "" },
    ...partial,
  };
}

describe("buildCampaignAiDigest (pure)", () => {
  it("serializes chapters, quests, factions, sessions and chronicle compactly", () => {
    const digest = buildCampaignAiDigest(
      overview({
        chapters: [
          {
            id: "ch1",
            title: "Akt I",
            slug: "akt-i",
            summary: "Der Aufbruch.",
            prepStatus: "played",
            sortIndex: 1,
            href: "#",
            questCounts: { open: 1, completed: 2, failed: 0, total: 3 },
          },
        ],
        unassignedQuests: [
          { id: "q1", title: "Lose Quest", slug: "lose-quest", href: "#", status: "open", chapterId: null },
        ],
        factions: [
          { pageId: "f1", title: "Rote Hand", href: "#", agenda: "Chaos stiften", powerLevel: 7 },
        ],
        lastSession: { id: "s1", title: "Auftakt", sessionNumber: 3, date: null, status: "played", href: "#" },
        nextSession: { id: "s2", title: "Weiter", sessionNumber: 4, date: null, status: "planned", href: "#" },
        recentEvents: [
          {
            id: "e1",
            title: "Der Turm fällt",
            summary: "Geheime DM-Notiz",
            inGameDate: { year: 1487, month: 3, day: 12 },
            dateLabel: "12. Regen 1487",
          },
        ],
        progress: { played: 1, total: 1, label: "1 von 1 Kapiteln gespielt" },
      }),
    );

    assert.ok(digest.startsWith("# Kampagnen-Cockpit (Digest)"));
    assert.ok(digest.includes("1. Akt I [gespielt] · Quests: 1 offen, 2 erledigt — Der Aufbruch."));
    assert.ok(digest.includes("Lose Quest (ohne Kapitel)"));
    assert.ok(digest.includes("Rote Hand [Macht 7] — Agenda: Chaos stiften"));
    assert.ok(digest.includes("Zuletzt gespielt: Session 3 „Auftakt“"));
    assert.ok(digest.includes("Als Nächstes geplant: Session 4 „Weiter“"));
    assert.ok(digest.includes("12. Regen 1487: Der Turm fällt — Geheime DM-Notiz"));
    // kompakt: deutlich unter dem Router-Budget
    assert.ok(digest.length < 4000);
  });

  it("stays readable for an empty campaign", () => {
    const digest = buildCampaignAiDigest(overview({}));
    assert.ok(digest.includes("noch keine Kapitel"));
    assert.ok(digest.includes("keine offenen Quests"));
    assert.ok(digest.includes("keine geplante Session"));
    assert.ok(digest.includes("noch keine Ereignisse"));
  });

  it("caps the chronicle at ten entries", () => {
    const events = Array.from({ length: 15 }, (_, index) => ({
      id: `e${index}`,
      title: `Ereignis ${index}`,
      summary: "",
      inGameDate: { year: 1, month: 1, day: index + 1 },
      dateLabel: `Tag ${index + 1}`,
    }));
    const digest = buildCampaignAiDigest(overview({ recentEvents: events }));
    assert.ok(digest.includes("Ereignis 9"));
    assert.ok(!digest.includes("Ereignis 10"));
  });
});
