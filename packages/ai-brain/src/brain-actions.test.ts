import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createTestDatabaseUrl } from "@uwe/database/test-helpers";
import {
  createBrainStoreService,
  createAiRunService,
  createUweRepository,
  seedTerraWorld,
} from "@uwe/database/server";
import { createGameSessionService } from "@uwe/database/server";
import {
  applyProposal,
  BRAIN_ACTION_LIST,
  buildProposalsFromResult,
  discardRun,
  getBrainAction,
  isBrainActionId,
  runBrainAction,
} from "./index";

describe("Brain Actions — catalog", () => {
  it("defines all P09 target actions plus the Terra map actions", () => {
    const ids = BRAIN_ACTION_LIST.map((action) => action.id);
    assert.ok(ids.includes("session_recap"));
    assert.ok(ids.includes("next_session_prep"));
    assert.ok(ids.includes("expand_knowledge"));
    assert.ok(ids.includes("create_knowledge_text"));
    assert.ok(ids.includes("canon_check"));
    assert.ok(ids.includes("player_handout"));
    assert.ok(ids.includes("fill_dungeon_room"));
    assert.ok(ids.includes("mail_draft"));
    assert.ok(ids.includes("terra_name_regions"), "terra_name_regions action must be present");
    assert.ok(ids.includes("terra_describe_region"), "terra_describe_region action must be present");
    assert.ok(ids.includes("terra_world_draft"), "terra_world_draft action must be present");
    assert.ok(ids.includes("campaign_chapter_draft"), "campaign_chapter_draft action must be present");
    assert.ok(ids.includes("campaign_session_hooks"), "campaign_session_hooks action must be present");
    // 13 before 28.07.2026: the four Atlas actions were replaced by two Terra
    // ones. That the retired ids are gone from EVERY file the union lives in —
    // including the two in @uwe/cookbook that no compiler watches — is checked
    // in `ai-task-taxonomy.test.ts`, not here. Since 08/2026 the two campaign
    // cockpit actions bring the catalog back to 13.
    assert.equal(BRAIN_ACTION_LIST.length, 13);
  });

  it("campaign actions require a campaign and are never player safe", () => {
    for (const id of ["campaign_chapter_draft", "campaign_session_hooks"] as const) {
      const action = getBrainAction(id);
      assert.equal(action.requiresCampaign, true);
      assert.equal(action.playerSafe, false);
      assert.equal(action.requiresSession, false);
    }
    assert.equal(
      getBrainAction("campaign_chapter_draft").defaultProposalTarget,
      "campaign_chapter_page",
    );
    assert.equal(
      getBrainAction("campaign_session_hooks").defaultProposalTarget,
      "session_open_plots",
    );
  });

  it("marks player-safe actions correctly", () => {
    assert.equal(getBrainAction("player_handout").playerSafe, true);
    assert.equal(getBrainAction("mail_draft").playerSafe, true);
    assert.equal(getBrainAction("session_recap").playerSafe, false);
  });

  it("validates action ids", () => {
    assert.ok(isBrainActionId("session_recap"));
    assert.ok(!isBrainActionId("unknown_action"));
  });
});

describe("Brain Actions — proposals", () => {
  it("builds mail draft proposal with subject metadata", () => {
    const action = getBrainAction("mail_draft");
    const proposals = buildProposalsFromResult({
      action,
      resultText: "Betreff: Session Recap\n\nDie Helden kehrten nach Arbor zurück.",
      sessionId: "sess-1",
    });
    assert.equal(proposals.length, 1);
    assert.equal(proposals[0]?.targetType, "mail_draft");
    assert.equal(proposals[0]?.metadata?.subject, "Session Recap");
    assert.equal(proposals[0]?.metadata?.autoSend, false);
  });

  it("builds session recap proposal for DM summary", () => {
    const action = getBrainAction("session_recap");
    const proposals = buildProposalsFromResult({
      action,
      resultText: "Die Session endete im Turm.",
      sessionId: "sess-1",
    });
    assert.equal(proposals[0]?.targetType, "session_summary_dm");
  });

  it("builds Wissenstext proposals as brain documents", () => {
    const action = getBrainAction("create_knowledge_text");
    const proposals = buildProposalsFromResult({
      action,
      resultText: "## Arbor\n\nArbor ist ein Waldaußenposten.",
      pageId: "page-1",
    });
    assert.equal(proposals.length, 1);
    assert.equal(proposals[0]?.targetType, "brain_document");
    assert.equal(proposals[0]?.metadata?.documentType, "world_knowledge");
  });

  it("builds review-only text proposals for the two Terra map actions", () => {
    for (const actionId of ["terra_name_regions", "terra_describe_region"] as const) {
      const action = getBrainAction(actionId);
      const proposals = buildProposalsFromResult({
        action,
        resultText: "  Nordwald: Immerlicht (Alternative: Blattschatten)  ",
        pageId: "page-1",
      });

      assert.equal(proposals.length, 1);
      assert.equal(proposals[0]?.targetType, action.defaultProposalTarget);
      // Kein visibility-Feld mehr (Schritt 3b): Vorschläge sind grundsätzlich
      // review-only und erreichen Spieler nie direkt.
      assert.equal(proposals[0]?.status, "pending");
      // Prose in, prose out — no validator, and never applied on its own.
      assert.equal(proposals[0]?.content, "Nordwald: Immerlicht (Alternative: Blattschatten)");
      assert.equal(proposals[0]?.metadata?.autoApply, false);
      assert.equal(proposals[0]?.metadata?.source, "ai_generated");
    }
  });

  it("clamps a Terra world draft instead of throwing it away", () => {
    const action = getBrainAction("terra_world_draft");
    const proposals = buildProposalsFromResult({
      action,
      // Markdown fence, an invented biome, a runaway count and a language
      // family that does not exist — exactly what a small local model does.
      resultText:
        '```json\n{"kind":"terra_world_draft","biom":"nebelheide","kartenGroesse":512,' +
        '"siedlungen":300,"sprachfamilie":"nordisch",' +
        '"namen":{"region":"Die Graue Küste","orte":["Möwenfurt"]}}\n```',
      pageId: "page-1",
    });

    assert.equal(proposals.length, 1);
    assert.equal(proposals[0]?.targetType, "terra_world_draft");
    assert.equal(proposals[0]?.metadata?.autoApply, false);
    assert.equal(proposals[0]?.metadata?.validation, "ok");
    assert.ok(Array.isArray(proposals[0]?.metadata?.notices));
    const entwurf = JSON.parse(proposals[0]?.content ?? "{}");
    assert.equal(entwurf.biom, "wiese", "unbekanntes Biom faellt auf die Vorgabe");
    assert.equal(entwurf.siedlungen, 14, "auf den Deckel des Generators geklemmt");
    assert.equal(entwurf.sprachfamilie, "auto", "erfundene Sprachfamilie abgelehnt");
    assert.equal(entwurf.kartenGroesse, 512, "was stimmt, bleibt stehen");
    assert.deepEqual(entwurf.namen.orte, ["Möwenfurt"]);
  });

  it("keeps a Terra world draft that carries geometry out of the map", () => {
    const action = getBrainAction("terra_world_draft");
    const proposals = buildProposalsFromResult({
      action,
      resultText: '{"kind":"terra_world_draft","elemente":[{"kind":"pfad","points":[{"x":1,"z":2}]}]}',
      pageId: "page-1",
    });

    assert.equal(proposals[0]?.metadata?.validation, "invalid");
    assert.ok(Array.isArray(proposals[0]?.metadata?.errors));
  });
});

describe("Brain Actions — end-to-end with mock provider", () => {
  let databaseUrl: string;

  beforeEach(() => {
    databaseUrl = createTestDatabaseUrl();
  });

  afterEach(async () => {
    const { createPrismaClient } = await import("@uwe/database/server");
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("runs expand_knowledge and stores AI run with proposals", async () => {
    const repo = createUweRepository(databaseUrl);
    const seeded = await seedTerraWorld(repo);
    const aiRuns = createAiRunService(databaseUrl);
    const brainStore = createBrainStoreService(databaseUrl);

    const result = await runBrainAction(
      { repo, aiRuns, brainStore, databaseUrl },
      {
        actionId: "expand_knowledge",
        worldSlug: seeded.world.slug,
        pageSlug: seeded.pages.arbor.slug,
        providerId: "ollama",
        model: "mock-model",
        useMock: true,
        options: { localOnly: true },
      },
    );

    assert.ok(result.runId);
    assert.ok(result.result.text.length > 0);
    assert.ok(result.proposals.length >= 1);

    const run = await aiRuns.getById(result.runId);
    assert.ok(run);
    assert.equal(run?.status, "completed");
    assert.ok(run?.resultText);
    assert.ok(Array.isArray(run?.proposals));
  });

  it("runs create_knowledge_text and applies it as a brain document", async () => {
    const repo = createUweRepository(databaseUrl);
    const seeded = await seedTerraWorld(repo);
    const aiRuns = createAiRunService(databaseUrl);
    const brainStore = createBrainStoreService(databaseUrl);

    const { runId, proposals } = await runBrainAction(
      { repo, aiRuns, brainStore, databaseUrl },
      {
        actionId: "create_knowledge_text",
        worldSlug: seeded.world.slug,
        pageSlug: seeded.pages.arbor.slug,
        providerId: "ollama",
        model: "mock-model",
        useMock: true,
        options: { localOnly: true },
      },
    );

    const proposal = proposals[0];
    assert.ok(proposal);
    assert.equal(proposal.targetType, "brain_document");

    await applyProposal(
      { repo, aiRuns, brainStore, databaseUrl },
      {
        runId,
        proposalId: proposal.id,
        editedContent: "Wissenstext über Arbor.",
      },
    );

    const documents = await brainStore.listDocuments(seeded.world.slug, {
      documentType: "world_knowledge",
    });
    const created = documents.find((doc) => doc.content === "Wissenstext über Arbor.");
    assert.ok(created);
    assert.equal(created.title, "Wissenstext");
    assert.equal(created.source, "ai_generated");
    assert.equal(created.status, "draft");
  });

  it("runs session_recap with session context and saves run history", async () => {
    const repo = createUweRepository(databaseUrl);
    const seeded = await seedTerraWorld(repo);
    const sessions = createGameSessionService(databaseUrl);
    const aiRuns = createAiRunService(databaseUrl);
    const brainStore = createBrainStoreService(databaseUrl);

    const session = await sessions.create({
      worldId: seeded.world.id,
      campaignId: seeded.campaign.id,
      title: "Brain Recap Test",
      sessionNumber: 99,
      linkedPageIds: [seeded.pages.validori.id],
    });

    const result = await runBrainAction(
      { repo, aiRuns, brainStore, databaseUrl },
      {
        actionId: "session_recap",
        worldSlug: seeded.world.slug,
        pageSlug: seeded.pages.validori.slug,
        providerId: "ollama",
        model: "mock-model",
        sessionId: session.id,
        useMock: true,
        options: { localOnly: true },
      },
    );

    const run = await aiRuns.getById(result.runId);
    assert.equal(run?.gameSessionId, session.id);
    assert.equal(run?.status, "completed");
  });

  it("apply and discard flow works without auto-overwrite before apply", async () => {
    const repo = createUweRepository(databaseUrl);
    const seeded = await seedTerraWorld(repo);
    const aiRuns = createAiRunService(databaseUrl);
    const brainStore = createBrainStoreService(databaseUrl);
    const sessions = createGameSessionService(databaseUrl);

    const session = await sessions.create({
      worldId: seeded.world.id,
      campaignId: seeded.campaign.id,
      title: "Apply Test",
      sessionNumber: 100,
      linkedPageIds: [seeded.pages.arbor.id],
    });

    const before = await sessions.getById(session.id);
    assert.equal(before?.summaryDm, null);

    const { runId, proposals } = await runBrainAction(
      { repo, aiRuns, brainStore, databaseUrl },
      {
        actionId: "session_recap",
        worldSlug: seeded.world.slug,
        pageSlug: seeded.pages.arbor.slug,
        providerId: "ollama",
        model: "mock-model",
        sessionId: session.id,
        useMock: true,
        options: { localOnly: true },
      },
    );

    const mid = await sessions.getById(session.id);
    assert.equal(mid?.summaryDm, null, "must not auto-apply before review");

    const proposal = proposals[0];
    assert.ok(proposal);

    await applyProposal(
      { repo, aiRuns, brainStore, databaseUrl },
      {
        runId,
        proposalId: proposal.id,
        editedContent: "Übernommenes Session-Recap.",
      },
    );

    const after = await sessions.getById(session.id);
    assert.equal(after?.summaryDm, "Übernommenes Session-Recap.");

    const appliedRun = await aiRuns.getById(runId);
    assert.equal(appliedRun?.status, "applied");
  });

  it("discard marks run as discarded", async () => {
    const repo = createUweRepository(databaseUrl);
    const seeded = await seedTerraWorld(repo);
    const aiRuns = createAiRunService(databaseUrl);
    const brainStore = createBrainStoreService(databaseUrl);

    const { runId } = await runBrainAction(
      { repo, aiRuns, brainStore, databaseUrl },
      {
        actionId: "canon_check",
        worldSlug: seeded.world.slug,
        pageSlug: seeded.pages.validori.slug,
        providerId: "ollama",
        model: "mock-model",
        useMock: true,
        options: { localOnly: true },
      },
    );

    await discardRun({ repo, aiRuns, brainStore, databaseUrl }, runId);
    const run = await aiRuns.getById(runId);
    assert.equal(run?.status, "discarded");
  });

  it("anchors campaign actions on the first chapter and tags the run with the campaign", async () => {
    const repo = createUweRepository(databaseUrl);
    const seeded = await seedTerraWorld(repo);
    const aiRuns = createAiRunService(databaseUrl);
    const brainStore = createBrainStoreService(databaseUrl);

    const chapterTwo = await repo.createPage({
      worldId: seeded.world.id,
      campaignId: seeded.campaign.id,
      title: "Akt II",
      slug: "akt-ii",
      type: "story_arc",
      sortIndex: 2,
    });
    const chapterOne = await repo.createPage({
      worldId: seeded.world.id,
      campaignId: seeded.campaign.id,
      title: "Akt I",
      slug: "akt-i",
      type: "story_arc",
      sortIndex: 1,
    });

    const { runId, proposals } = await runBrainAction(
      { repo, aiRuns, brainStore, databaseUrl },
      {
        actionId: "campaign_chapter_draft",
        worldSlug: seeded.world.slug,
        campaignSlug: seeded.campaign.slug,
        campaignId: seeded.campaign.id,
        extraPromptContext: "# Kampagnen-Cockpit (Digest)\nOffene Quests: Testquest",
        providerId: "ollama",
        model: "mock-model",
        useMock: true,
        options: { localOnly: true },
      },
    );

    const run = await aiRuns.getById(runId);
    assert.ok(run);
    // Anker = erstes Kapitel in Lesereihenfolge, nicht das zuerst angelegte.
    assert.equal(run?.pageId, chapterOne.id);
    assert.notEqual(run?.pageId, chapterTwo.id);
    const meta = run?.resultMeta as { campaignId?: string | null } | null;
    assert.equal(meta?.campaignId, seeded.campaign.id);

    const proposal = proposals[0];
    assert.ok(proposal);
    assert.equal(proposal.targetType, "campaign_chapter_page");
    assert.equal(proposal.metadata?.campaignId, seeded.campaign.id);
  });

  it("refuses campaign actions without a campaign", async () => {
    const repo = createUweRepository(databaseUrl);
    const seeded = await seedTerraWorld(repo);
    const aiRuns = createAiRunService(databaseUrl);
    const brainStore = createBrainStoreService(databaseUrl);

    await assert.rejects(
      runBrainAction(
        { repo, aiRuns, brainStore, databaseUrl },
        {
          actionId: "campaign_session_hooks",
          worldSlug: seeded.world.slug,
          providerId: "ollama",
          model: "mock-model",
          useMock: true,
          options: { localOnly: true },
        },
      ),
      /erfordert eine Kampagne/,
    );
  });
});
