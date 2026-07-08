import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createUweRepository } from "@uwe/database/server";
import { createTestDatabaseUrl } from "@uwe/database/test-helpers";
import {
  WORLD_LIST_CACHE_TAG,
  loadStudioWorldList,
  projectStudioWorld,
} from "./world-list";

describe("studio world list (WS5 cache source)", () => {
  it("exposes a stable cache tag", () => {
    assert.equal(WORLD_LIST_CACHE_TAG, "studio:world-list");
  });

  it("projects a world to serialization-safe scalars only", () => {
    const item = projectStudioWorld({
      id: "w1",
      name: "Aventurien",
      slug: "aventurien",
      description: "Beschreibung",
      isSandbox: true,
      // Extra fields (incl. Date columns) must be dropped by the projection.
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    // deepEqual proves the projection keeps only these scalar fields — no Date
    // columns leak through, so it round-trips cleanly through unstable_cache.
    assert.deepEqual(item, {
      id: "w1",
      name: "Aventurien",
      slug: "aventurien",
      description: "Beschreibung",
      isSandbox: true,
    });
  });

  it("loads and projects the world list from the repository", async () => {
    const url = createTestDatabaseUrl();
    const repo = createUweRepository(url);
    await repo.createWorld({ name: "World One", slug: "world-one", description: "First" });
    await repo.createWorld({ name: "World Two", slug: "world-two" });

    const list = await loadStudioWorldList(repo);
    const slugs = list.map((world) => world.slug).sort();
    assert.deepEqual(slugs, ["world-one", "world-two"]);
    const first = list.find((world) => world.slug === "world-one");
    assert.equal(first?.name, "World One");
    assert.equal(first?.description, "First");
  });
});
