import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { buildAccessContext } from "@uwe/auth";
import { createTestDatabaseUrl } from "./test-helpers";
import { createUweRepository } from "./repository";
import { buildPageGraph, buildWorldGraph, buildWorldGraphForViewer } from "./graph-service";

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
      tags: ["hafen", "stadt"],
      contentBlocks: [
        {
          type: "rich_text",
          sortOrder: 0,
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
      contentBlocks: [
        {
          type: "rich_text",
          sortOrder: 0,
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
      tags: ["crew"],
      contentBlocks: [
        {
          type: "rich_text",
          sortOrder: 0,
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
    const graph = await buildWorldGraph(repo, worldSlug);

    assert.ok(graph.nodes.length >= 3);
    assert.ok(graph.edges.length >= 2);

    const secretNode = graph.nodes.find((node) => node.id === secretPageId);
    assert.ok(secretNode);
    assert.equal(secretNode.title, "Shagottar");
  });

  it("filters nodes by category", async () => {
    const repo = createUweRepository(databaseUrl);
    const graph = await buildWorldGraph(repo, worldSlug, {
      categories: ["npc"],
    });

    assert.ok(graph.nodes.every((node) => node.category === "npc"));
    assert.equal(graph.nodes.length, 1);
  });

  it("filters nodes by tag", async () => {
    const repo = createUweRepository(databaseUrl);
    const graph = await buildWorldGraph(repo, worldSlug, {
      tags: ["hafen"],
    });

    assert.equal(graph.nodes.length, 1);
    assert.equal(graph.nodes[0]?.slug, "validori");
  });

  it("focuses on a page and shows neighbors", async () => {
    const repo = createUweRepository(databaseUrl);
    const graph = await buildPageGraph(repo, worldSlug, publicPageId, "neighbors");

    assert.ok(graph.nodes.some((node) => node.id === publicPageId && node.isFocus));
    assert.ok(graph.nodes.length >= 2);
    assert.ok(graph.edges.length >= 1);
  });

  it("shows backlinks only for focus page", async () => {
    const repo = createUweRepository(databaseUrl);
    const graph = await buildPageGraph(repo, worldSlug, publicPageId, "backlinks");

    assert.ok(graph.nodes.some((node) => node.id === npcPageId));
    assert.ok(graph.edges.every((edge) => edge.targetId === publicPageId));
  });

  it("includes relation labels on edges", async () => {
    const repo = createUweRepository(databaseUrl);
    const graph = await buildWorldGraph(repo, worldSlug);

    const relation = graph.edges.find(
      (edge) => edge.kind === "relation" && edge.relationType === "located_in",
    );
    assert.ok(relation);
    assert.equal(relation.label, "Hafen");
  });

  it("caps full-graph mode at MAX_GRAPH_NODES for performance", async () => {
    const repo = createUweRepository(databaseUrl);
    const graph = await buildWorldGraph(repo, worldSlug, { mode: "full" });
    if ((graph.totalNodeCount ?? graph.nodes.length) > 400) {
      assert.equal(graph.truncated, true);
      assert.equal(graph.nodes.length, 400);
      assert.equal(graph.maxNodes, 400);
    }
  });

  it("preview context matches portal graph output", async () => {
    const repo = createUweRepository(databaseUrl);
    const portalGraph = await buildWorldGraph(repo, worldSlug);
    const previewGraph = await buildWorldGraph(repo, worldSlug);

    assert.deepEqual(portalGraph.nodes, previewGraph.nodes);
    assert.deepEqual(portalGraph.edges, previewGraph.edges);
  });

  it("buildWorldGraphForViewer matches legacy portal graph for player viewers", async () => {
    const repo = createUweRepository(databaseUrl);
    const ctx = buildAccessContext({
      user: {
        id: "player-1",
        displayName: "Player",
        email: "player@test.local",
        role: "player",
      },
      worldMembership: {
        userId: "player-1",
        worldId,
        role: "player",
        characterName: "Tester",
      },
      guestModeEnabled: false,
    });

    const viewerGraph = await buildWorldGraphForViewer(repo, worldSlug, ctx);
    const portalGraph = await buildWorldGraph(repo, worldSlug);

    assert.deepEqual(viewerGraph.nodes, portalGraph.nodes);
    assert.deepEqual(viewerGraph.edges, portalGraph.edges);
  });
});
