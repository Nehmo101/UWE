import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  continuationKindLabel,
  createContinueWorkService,
  rankContinuations,
  type Continuation,
} from "./continue-work-service";
import { createPrismaClient } from "./client";
import { createTestDatabaseUrl } from "./test-helpers";

function cont(overrides: Partial<Continuation>): Continuation {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    kind: "capture",
    title: "x",
    hint: "y",
    href: "/",
    sortDate: overrides.sortDate ?? new Date("2026-07-01T00:00:00Z"),
    ...overrides,
  };
}

describe("rankContinuations (pure)", () => {
  it("sorts by most recent activity and truncates to the limit", () => {
    const ranked = rankContinuations(
      [
        cont({ id: "old", sortDate: new Date("2026-01-01") }),
        cont({ id: "new", sortDate: new Date("2026-07-03") }),
        cont({ id: "mid", sortDate: new Date("2026-04-01") }),
      ],
      2,
    );
    assert.deepEqual(ranked.map((c) => c.id), ["new", "mid"]);
  });

  it("labels kinds in German", () => {
    assert.equal(continuationKindLabel("workshop"), "Werkstatt");
    assert.equal(continuationKindLabel("scan"), "Scan");
  });
});

describe("continue-work service (integration)", () => {
  let db: ReturnType<typeof createPrismaClient>;

  before(async () => {
    db = createPrismaClient(createTestDatabaseUrl());
    await db.captureEntry.create({ data: { title: "Idee", content: "Brotrezept ändern", captureType: "quick_note", status: "inbox" } });
    await db.personalProject.create({
      data: { name: "UWE Feature", status: "active", nextAction: "Radar testen", updatedAt: new Date("2026-07-02") },
    });
    // A project without a next action must not appear.
    await db.personalProject.create({ data: { name: "Ohne Schritt", status: "active" } });
    await db.scanDocument.create({
      data: { title: "Stromrechnung", status: "proposal_ready", storageKey: "_scan/x", mimeType: "image/jpeg" },
    });
  });

  after(async () => {
    await db.$disconnect();
  });

  it("aggregates open work into a ranked continuation list", async () => {
    const items = await createContinueWorkService(db).getContinuations(10);
    const kinds = items.map((i) => i.kind);
    assert.ok(kinds.includes("capture"));
    assert.ok(kinds.includes("project"));
    assert.ok(kinds.includes("scan"));
    // The action-less project is excluded.
    assert.ok(!items.some((i) => i.title === "Ohne Schritt"));

    const project = items.find((i) => i.kind === "project");
    assert.equal(project?.hint, "Radar testen");
  });
});
