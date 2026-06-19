import type { PrismaClient } from "./client";
import { GameSessionService } from "./game-session";
import { parseStringArray } from "./json-utils";
import type { UweRepository } from "./repository";
import { createLifeAdminService } from "./life-admin-service";
import type { PerfScale } from "./stress-seed-types";

export type { PerfScale } from "./stress-seed-types";
export { PERF_SMOKE_SCALE, PERF_STRESS_SCALE } from "./perf-budgets";

const PAGE_TYPES = [
  "lore",
  "location",
  "region",
  "npc",
  "faction",
  "item",
  "handout",
  "session",
  "quest",
  "note",
] as const;

const BASE_TAGS = [
  "stadt",
  "wald",
  "politik",
  "magie",
  "dungeon",
  "npc",
  "quest",
  "session",
  "handout",
  "karte",
  "fraktion",
  "item",
  "lore",
  "region",
  "encounter",
];

/** Intentional near-duplicates for tag-cleanup testing */
const TAG_VARIANTS = [
  ["stadt", "Stadt", "STADT"],
  ["wald", "Wald", "Wälder"],
  ["politik", "Politik", "politics"],
  ["magie", "Magie", "magic"],
  ["npc", "NPC", "npcs"],
  ["dungeon", "Dungeon", "dungeons"],
  ["handout", "Handout", "handouts"],
  ["quest", "Quest", "quests"],
  ["karte", "Karte", "map"],
  ["fraktion", "Fraktion", "faction"],
];

function pickTags(index: number, variantCount: number): string[] {
  const tags: string[] = [];
  const base = BASE_TAGS[index % BASE_TAGS.length]!;
  tags.push(base);

  const variantGroup = TAG_VARIANTS[index % TAG_VARIANTS.length]!;
  const variant = variantGroup[index % variantGroup.length]!;
  if (variant !== base) {
    tags.push(variant);
  }

  if (variantCount > 0 && index % 7 === 0) {
    const extra = TAG_VARIANTS[(index + 3) % TAG_VARIANTS.length]!;
    tags.push(extra[0]!);
  }

  return [...new Set(tags)];
}

export interface StressSeedResult {
  worldId: string;
  worldSlug: string;
  campaignId: string;
  pageIds: string[];
  stats: {
    pages: number;
    links: number;
    assets: number;
    captures: number;
    sessions: number;
    handouts: number;
    workshopProjects: number;
    personalBrainDocs: number;
  };
}

export async function seedStressWorld(
  repo: UweRepository,
  db: PrismaClient,
  scale: PerfScale,
): Promise<StressSeedResult> {
  const world = await repo.createWorld({
    name: "Perf Test World",
    slug: "perf-test",
    description:
      "Synthetic world for performance smoke tests, tag cleanup, and scale validation.",
  });

  const campaign = await repo.createCampaign({
    worldId: world.id,
    name: "Perf Campaign",
    slug: "perf-campaign",
    description: "Stress-test campaign with many linked pages.",
  });

  const lifeAdmin = createLifeAdminService(db);
  const sessions = new GameSessionService(db);

  const pageIds: string[] = [];
  const batchSize = 25;

  for (let batch = 0; batch < Math.ceil(scale.pages / batchSize); batch++) {
    const start = batch * batchSize;
    const end = Math.min(start + batchSize, scale.pages);
    const created = await Promise.all(
      Array.from({ length: end - start }, (_, offset) => {
        const i = start + offset;
        const type = PAGE_TYPES[i % PAGE_TYPES.length]!;
        return repo.createPage({
          worldId: world.id,
          campaignId: campaign.id,
          title: `Perf Page ${i + 1}`,
          slug: `perf-page-${i + 1}`,
          type,
          summary: `Synthetic page ${i + 1} for performance testing.`,
          visibility: i % 5 === 0 ? "dm_only" : "player_visible",
          publishStatus: i % 3 === 0 ? "draft" : "published",
          canonicalStatus: "canon",
          tags: pickTags(i, scale.tagVariants),
          contentBlocks: [
            {
              type: "rich_text",
              sortOrder: 0,
              visibility: "public",
              content: `Content for perf page ${i + 1}. Links to [[Perf Page ${((i + 1) % scale.pages) + 1}]].`,
            },
          ],
        });
      }),
    );
    pageIds.push(...created.map((page) => page.id));
  }

  let linkCount = 0;
  for (let i = 0; i < scale.links; i++) {
    const sourceIdx = i % pageIds.length;
    const targetIdx = (i * 7 + 13) % pageIds.length;
    if (sourceIdx === targetIdx) continue;
    await repo.createPageLink({
      sourcePageId: pageIds[sourceIdx]!,
      targetPageId: pageIds[targetIdx]!,
      relationType: i % 2 === 0 ? "related" : "mentions",
    });
    linkCount++;
  }

  for (let i = 0; i < scale.assets; i++) {
    await repo.createAsset({
      worldId: world.id,
      campaignId: campaign.id,
      title: `Perf Asset ${i + 1}`,
      type: i % 3 === 0 ? "map" : "image",
      storageKey: `perf-test/asset-${i + 1}.png`,
      mimeType: "image/png",
      size: 1024 + i,
      visibility: "dm_only",
      tags: pickTags(i, scale.tagVariants),
    });
  }

  for (let i = 0; i < scale.captures; i++) {
    await lifeAdmin.createCapture({
      title: `Perf Capture ${i + 1}`,
      content: `Captured note ${i + 1} for triage testing.`,
      captureType: i % 4 === 0 ? "link" : "quick_note",
      status: i % 5 === 0 ? "triaged" : "inbox",
      worldId: i % 3 === 0 ? world.id : undefined,
      metadata: i % 7 === 0 ? { tags: pickTags(i, 0) } : undefined,
    });
  }

  for (let i = 0; i < scale.workshopProjects; i++) {
    await lifeAdmin.createWorkshopProject({
      title: `Perf Workshop ${i + 1}`,
      projectType: "dnd_terrain",
      status: i % 2 === 0 ? "in_progress" : "planned",
      description: "Synthetic workshop entry.",
    });
  }

  for (let i = 0; i < scale.personalBrainDocs; i++) {
    await lifeAdmin.createPersonalBrainDocument({
      title: `Perf Brain Doc ${i + 1}`,
      content: `Homelab and campaign notes entry ${i + 1}.`,
      category: i % 2 === 0 ? "homelab" : "campaign",
      tags: pickTags(i, scale.tagVariants),
    });
  }

  const handoutPageIds: string[] = [];
  for (let i = 0; i < scale.handouts; i++) {
    const page = await repo.createPage({
      worldId: world.id,
      campaignId: campaign.id,
      title: `Perf Handout ${i + 1}`,
      slug: `perf-handout-${i + 1}`,
      type: "handout",
      summary: "Player handout for perf testing.",
      visibility: "player_visible",
      publishStatus: "published",
      tags: ["handout", ...pickTags(i, 0)],
      contentBlocks: [
        {
          type: "player_text",
          sortOrder: 0,
          visibility: "player_visible",
          content: `Handout content ${i + 1}.`,
        },
      ],
    });
    handoutPageIds.push(page.id);
  }

  for (let i = 0; i < scale.sessions; i++) {
    const linked = [
      pageIds[i % pageIds.length]!,
      handoutPageIds[i % handoutPageIds.length]!,
    ].filter(Boolean);
    await sessions.create({
      worldId: world.id,
      campaignId: campaign.id,
      title: `Perf Session ${i + 1}`,
      sessionNumber: i + 1,
      status: i % 3 === 0 ? "played" : "planned",
      summaryPlayer: `Recap for session ${i + 1}.`,
      linkedPageIds: linked,
    });
  }

  return {
    worldId: world.id,
    worldSlug: world.slug,
    campaignId: campaign.id,
    pageIds,
    stats: {
      pages: pageIds.length,
      links: linkCount,
      assets: scale.assets,
      captures: scale.captures,
      sessions: scale.sessions,
      handouts: scale.handouts,
      workshopProjects: scale.workshopProjects,
      personalBrainDocs: scale.personalBrainDocs,
    },
  };
}

/** Verify stress world tag variants are present (for tag-service tests). */
export function countDistinctPageTags(db: PrismaClient, worldId: string): Promise<number> {
  return db.page
    .findMany({ where: { worldId }, select: { tags: true } })
    .then((pages) => {
      const set = new Set<string>();
      for (const page of pages) {
        for (const tag of parseStringArray(page.tags)) {
          set.add(tag);
        }
      }
      return set.size;
    });
}
