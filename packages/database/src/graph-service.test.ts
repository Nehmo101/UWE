import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createTestDatabaseUrl } from "./test-helpers";
import { createUweRepository } from "./repository";
import { buildPageGraph, buildWorldGraph } from "./graph-service";

describe("graph-service", () => {
  let databaseUrl: string;
  let worldSlug: string;
  let worldId: string;
  let publicPageId: string;
  let secretPageId: string;
  let npcPageId: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    const repo = createUweRepository(databaseUrl);

    const world = await repo.createWorld({
      name: "Graph Test",
      slug: "graph-test",
      description: "Graph tests",
    });
    worldSlug = world.slug;
    worldId = world.id;

    const publicPage = await repo.createPage({
      worldId,
      title: "Hafenstadt Validori",
      slug: "validori",
      type: "location",
      visibility: "public",
      publishStatus: "published",
      tags: ["hafen", "stadt"],
      contentBlocks: [
        {
          type: "rich_text",
          sortOrder: 0,
          visibility: "public",
          content: "Die Stadt [[Shagottar|Festung]] liegt im Norden.",
        },
      ],
    });
    publicPageId = publicPage.id;

    const secretPage = await repo.createPage({
      worldId,
      title: "Shagottar",
      slug: "shagottar",
      type: "location",
      visibility: "dm_only",
      publishStatus: "published",
      contentBlocks: [
        {
          type: "gm_note",
          sortOrder: 0,
          visibility: "dm_only",
          content: "Geheime Festung.",
        },
      ],
    });
    secretPageId = secretPage.id;

    const npcPage = await repo.createPage({
      worldId,
      title: "Kapitän Mara",
      slug: "kapitän-mara",
      type: "npc",
      visibility: "player_visible",
      publishStatus: "published",
      tags: ["crew"],
      contentBlocks: [
        {
          type: "rich_text",
          sortOrder: 0,
          visibility: "player_visible",
          content: "Mara segelt nach [[Hafenstadt Validori]].",
        },
      ],
    });
    npcPageId = npcPage.id;

    await repo.createPageLink({
      sourcePageId: publicPageId,
      targetPageId: secretPageId,
      relationType: "threatens",
      label: "bedroht",
    });

    await repo.createPageLink({
      sourcePageId: npcPageId,
      targetPageId: publicPageId,
      relationType: "located_in",
      label: "Hafen",
    });
  });

  after(async () => {
    const { createPrismaClient } = await import("./client");
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("builds nodes and edges for DM context", async () => {
    const repo = createUweRepository(databaseUrl);
    const graph = await buildWorldGraph(repo, worldSlug, "dm");

    assert.ok(graph.nodes.length >= 3);
    assert.ok(graph.edges.length >= 2);

    const secretNode = graph.nodes.find((node) => node.id === secretPageId);
    assert.ok(secretNode);
    assert.equal(secretNode.title, "Shagottar");
  });

  it("filters nodes by category", async () => {
    const repo = createUweRepository(databaseUrl);
    const graph = await buildWorldGraph(repo, worldSlug, "dm", {
      categories: ["npc"],
    });

    assert.ok(graph.nodes.every((node) => node.category === "npc"));
    assert.equal(graph.nodes.length, 1);
  });

  it("filters nodes by tag", async () => {
    const repo = createUweRepository(databaseUrl);
    const graph = await buildWorldGraph(repo, worldSlug, "dm", {
      tags: ["hafen"],
    });

    assert.equal(graph.nodes.length, 1);
    assert.equal(graph.nodes[0]?.slug, "validori");
  });

  it("filters nodes by visibility", async () => {
    const repo = createUweRepository(databaseUrl);
    const graph = await buildWorldGraph(repo, worldSlug, "dm", {
      visibilities: ["dm_only"],
    });

    assert.equal(graph.nodes.length, 1);
    assert.equal(graph.nodes[0]?.title, "Shagottar");
  });

  it("focuses on a page and shows neighbors", async () => {
    const repo = createUweRepository(databaseUrl);
    const graph = await buildPageGraph(repo, worldSlug, publicPageId, "dm", "neighbors");

    assert.ok(graph.nodes.some((node) => node.id === publicPageId && node.isFocus));
    assert.ok(graph.nodes.length >= 2);
    assert.ok(graph.edges.length >= 1);
  });

  it("shows backlinks only for focus page", async () => {
    const repo = createUweRepository(databaseUrl);
    const graph = await buildPageGraph(repo, worldSlug, publicPageId, "dm", "backlinks");

    assert.ok(graph.nodes.some((node) => node.id === npcPageId));
    assert.ok(graph.edges.every((edge) => edge.targetId === publicPageId));
  });

  it("includes relation labels on edges", async () => {
    const repo = createUweRepository(databaseUrl);
    const graph = await buildWorldGraph(repo, worldSlug, "dm");

    const relation = graph.edges.find(
      (edge) => edge.kind === "relation" && edge.relationType === "located_in",
    );
    assert.ok(relation);
    assert.equal(relation.label, "Hafen");
  });

  it("does not expose secret pages or dm-only relations in portal graph", async () => {
    const repo = createUweRepository(databaseUrl);
    const graph = await buildWorldGraph(repo, worldSlug, "portal");

    const titles = graph.nodes.map((node) => node.title);
    assert.ok(!titles.includes("Shagottar"));

    const secretEdges = graph.edges.filter(
      (edge) => edge.sourceId === secretPageId || edge.targetId === secretPageId,
    );
    assert.equal(secretEdges.length, 0);

    const dmRelation = graph.edges.find((edge) => edge.relationType === "threatens");
    assert.equal(dmRelation, undefined);
  });

  it("does not leak secret titles via wiki edges in portal graph", async () => {
    const repo = createUweRepository(databaseUrl);
    const graph = await buildWorldGraph(repo, worldSlug, "portal");

    const labels = graph.edges.map((edge) => edge.label.toLowerCase());
    assert.ok(!labels.some((label) => label.includes("shagottar")));
    assert.ok(!labels.some((label) => label.includes("festung")));
  });

  it("preview context matches portal graph output", async () => {
    const repo = createUweRepository(databaseUrl);
    const portalGraph = await buildWorldGraph(repo, worldSlug, "portal");
    const previewGraph = await buildWorldGraph(repo, worldSlug, "preview");

    assert.deepEqual(portalGraph.nodes, previewGraph.nodes);
    assert.deepEqual(portalGraph.edges, previewGraph.edges);
  });
});
