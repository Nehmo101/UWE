import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  classifyDue,
  computeNextDue,
  createMaintenanceService,
} from "./maintenance-service";
import { createPrismaClient } from "./client";
import { createTestDatabaseUrl } from "./test-helpers";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("computeNextDue (pure)", () => {
  const from = new Date("2026-01-15T10:00:00.000Z");

  it("returns null for a one-off task", () => {
    assert.equal(computeNextDue("once", from), null);
  });

  it("adds fixed day offsets for weekly and biweekly", () => {
    assert.equal(computeNextDue("weekly", from)?.getTime(), from.getTime() + 7 * DAY_MS);
    assert.equal(computeNextDue("biweekly", from)?.getTime(), from.getTime() + 14 * DAY_MS);
  });

  it("advances calendar months/years", () => {
    assert.equal(computeNextDue("monthly", from)?.toISOString(), "2026-02-15T10:00:00.000Z");
    assert.equal(computeNextDue("quarterly", from)?.toISOString(), "2026-04-15T10:00:00.000Z");
    assert.equal(computeNextDue("yearly", from)?.toISOString(), "2027-01-15T10:00:00.000Z");
  });

  it("clamps to the last day of a shorter month", () => {
    const endOfJan = new Date("2026-01-31T10:00:00.000Z");
    // Februar 2026 hat 28 Tage → nicht in den März überlaufen.
    assert.equal(computeNextDue("monthly", endOfJan)?.toISOString().slice(0, 10), "2026-02-28");
  });
});

describe("classifyDue (pure)", () => {
  const now = new Date("2026-07-03T12:00:00.000Z");

  it("is none without a due date", () => {
    assert.equal(classifyDue(null, now), "none");
    assert.equal(classifyDue(undefined, now), "none");
  });

  it("is overdue in the past", () => {
    assert.equal(classifyDue(new Date(now.getTime() - DAY_MS), now), "overdue");
  });

  it("is soon within the window", () => {
    assert.equal(classifyDue(new Date(now.getTime() + 3 * DAY_MS), now), "soon");
  });

  it("is later beyond the window", () => {
    assert.equal(classifyDue(new Date(now.getTime() + 40 * DAY_MS), now), "later");
  });
});

describe("maintenance service (integration)", () => {
  let db: ReturnType<typeof createPrismaClient>;

  before(() => {
    db = createPrismaClient(createTestDatabaseUrl());
  });

  after(async () => {
    await db.$disconnect();
  });

  it("create → markDone sets lastDoneAt and derives nextDueAt", async () => {
    const service = createMaintenanceService(db);
    const task = await service.create({
      title: "Rauchmelder prüfen",
      category: "Rauchmelder",
      interval: "yearly",
    });
    assert.equal(task.title, "Rauchmelder prüfen");

    const now = new Date("2026-07-03T09:00:00.000Z");
    const done = await service.markDone(task.id, now);
    assert.equal(done.lastDoneAt?.toISOString(), now.toISOString());
    assert.equal(done.nextDueAt?.toISOString(), "2027-07-03T09:00:00.000Z");
  });

  it("getUpcoming finds overdue tasks and flags them", async () => {
    const service = createMaintenanceService(db);
    const now = new Date("2026-07-03T12:00:00.000Z");

    const overdue = await service.create({
      title: "Müll rausbringen",
      category: "Müll",
      interval: "weekly",
      nextDueAt: new Date(now.getTime() - 2 * DAY_MS),
    });
    await service.create({
      title: "Filter tauschen",
      category: "Geräte",
      interval: "yearly",
      nextDueAt: new Date(now.getTime() + 365 * DAY_MS),
    });

    const upcoming = await service.getUpcoming(14, now);
    const found = upcoming.find((t) => t.id === overdue.id);
    assert.ok(found, "überfällige Aufgabe muss enthalten sein");
    assert.equal(found?.overdue, true);
    assert.equal(found?.dueClass, "overdue");
    // Die weit entfernte Aufgabe darf nicht im 14-Tage-Fenster liegen.
    assert.ok(!upcoming.some((t) => t.title === "Filter tauschen"));
  });
});
