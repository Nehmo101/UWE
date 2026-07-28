import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildEncounterPageInput,
  buildStatblockPageInput,
  createEncounterPage,
  gatherEncounterCandidates,
  importOpen5eStatblockPage,
  resolveUniquePageSlug,
  type DndCreatePageInput,
  type EncounterCandidate,
  type PageSlugLookup,
} from "./index";

/** Simple deterministic slugifier for tests (matches the app's spirit). */
const slugify = (title: string): string =>
  title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function slugLookupFor(existing: string[]): PageSlugLookup {
  const set = new Set(existing);
  return {
    getPageBySlug: async (_worldSlug: string, pageSlug: string) =>
      set.has(pageSlug) ? { id: pageSlug } : null,
  };
}

/** Records created pages and returns a minimal page-like record. */
function fakeRepo(existing: string[] = []) {
  const created: DndCreatePageInput[] = [];
  const lookup = slugLookupFor(existing);
  return {
    created,
    getPageBySlug: lookup.getPageBySlug,
    createPage: async (input: DndCreatePageInput) => {
      created.push(input);
      return { id: `page-${input.slug}`, type: input.type, slug: input.slug };
    },
  };
}

describe("resolveUniquePageSlug", () => {
  it("returns the base slug when there is no collision", async () => {
    const slug = await resolveUniquePageSlug(slugLookupFor([]), "mundus", "goblin");
    assert.equal(slug, "goblin");
  });

  it("appends an incrementing counter until a free slug is found", async () => {
    const slug = await resolveUniquePageSlug(
      slugLookupFor(["goblin", "goblin-2", "goblin-3"]),
      "mundus",
      "goblin",
    );
    assert.equal(slug, "goblin-4");
  });
});

describe("buildStatblockPageInput", () => {
  it("assembles a monster page with a statblock block", () => {
    const input = buildStatblockPageInput({
      worldId: "w1",
      open5eSlug: "goblin",
      title: "Goblin",
      pageSlug: "goblin",
      markdown: "# Goblin",
    });

    assert.equal(input.type, "monster");
    assert.equal(input.summary, "Open5e Statblock (goblin)");
    assert.deepEqual(input.contentBlocks, [
      { type: "statblock", sortOrder: 0, content: "# Goblin" },
    ]);
  });
});

describe("buildEncounterPageInput", () => {
  it("assembles a encounter page with a rich_text block", () => {
    const input = buildEncounterPageInput({
      worldId: "w1",
      title: "Ambush",
      pageSlug: "ambush-encounter",
      markdown: "# Encounter",
      summary: "3 Monster",
    });

    assert.equal(input.type, "encounter");
    assert.equal(input.summary, "3 Monster");
    assert.deepEqual(input.contentBlocks, [
      { type: "rich_text", sortOrder: 0, content: "# Encounter" },
    ]);
  });
});

describe("importOpen5eStatblockPage", () => {
  it("derives the title from the monster name and resolves a unique slug", async () => {
    const repo = fakeRepo(["goblin-goblin"]);
    const page = await importOpen5eStatblockPage(repo, {
      worldId: "w1",
      worldSlug: "mundus",
      open5eSlug: "goblin",
      title: undefined,
      monster: { name: "Goblin" },
      slugify,
    });

    assert.equal(page.type, "monster");
    assert.equal(repo.created.length, 1);
    const created = repo.created[0]!;
    assert.equal(created.title, "Goblin");
    // base slug "goblin-goblin" is taken -> next candidate
    assert.equal(created.slug, "goblin-goblin-2");
  });

  it("falls back to the open5e slug when the monster has no name", async () => {
    const repo = fakeRepo();
    await importOpen5eStatblockPage(repo, {
      worldId: "w1",
      worldSlug: "mundus",
      open5eSlug: "mystery-beast",
      title: "   ",
      monster: {},
      slugify,
    });

    assert.equal(repo.created[0]!.title, "mystery-beast");
  });
});

describe("createEncounterPage", () => {
  it("creates a encounter page with a monster-count summary", async () => {
    const repo = fakeRepo();
    await createEncounterPage(repo, {
      worldId: "w1",
      worldSlug: "mundus",
      title: "Goblin Ambush",
      partyLevel: 3,
      partySize: 4,
      monsters: [
        { name: "Goblin", cr: "1/4", slug: "goblin", count: 3 },
        { name: "Hobgoblin", cr: "1/2", slug: "hobgoblin" },
      ],
      slugify,
    });

    const created = repo.created[0]!;
    assert.equal(created.type, "encounter");
    assert.equal(created.slug, "goblin-ambush-encounter");
    assert.equal(created.summary, "4 Monster");
    assert.equal(created.contentBlocks[0]!.type, "rich_text");
  });
});

describe("gatherEncounterCandidates", () => {
  it("fans out over CR buckets and flattens the results in order", async () => {
    const byCr: Record<string, EncounterCandidate[]> = {
      "2": [{ name: "Ogre", slug: "ogre", cr: "2" }],
      "1": [
        { name: "Goblin", slug: "goblin", cr: "1" },
        { name: "Kobold", slug: "kobold", cr: "1" },
      ],
    };
    const candidates = await gatherEncounterCandidates(["2", "1"], async (cr) => byCr[cr] ?? []);

    assert.deepEqual(
      candidates.map((c) => c.slug),
      ["ogre", "goblin", "kobold"],
    );
  });
});
