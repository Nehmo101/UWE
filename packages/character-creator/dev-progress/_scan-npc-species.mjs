#!/usr/bin/env node
/**
 * Scan Page.type=npc for species-like terms in wiki content.
 *
 * Run from repo root:
 *   pnpm exec tsx packages/character-creator/dev-progress/_scan-npc-species.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPrismaClient, disconnectPrismaClientIfOwned } from "../../database/src/client.ts";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../../..");
const databaseUrl = `file:${path.join(repoRoot, "packages/database/data/uwe.db")}`;

/** @type {Array<{ pattern: RegExp; term: string; suggestedKey: string; lineageKey?: string }>} */
const SPECIES_TERMS = [
  { term: "Drachenblütige", pattern: /\bdrachenblütige?\b/i, suggestedKey: "drachenblutige" },
  { term: "Dragonborn", pattern: /\bdragonborn\b/i, suggestedKey: "drachenblutige" },
  { term: "Drascari", pattern: /\bdrascari\b/i, suggestedKey: "drachenblutige" },
  { term: "Zwerg", pattern: /\bzwerg(?:e|en|es)?\b/i, suggestedKey: "zwerg" },
  { term: "Dwarf", pattern: /\bdwarves?\b/i, suggestedKey: "zwerg" },
  { term: "Elf", pattern: /\b(?:sun|moon|wood|high)?\s*el(?:f|fe|fen)\b/i, suggestedKey: "elf" },
  { term: "Gnom", pattern: /\bgnom(?:e|en|es)?\b/i, suggestedKey: "gnom" },
  { term: "Goliath", pattern: /\bgoliath(?:s|en)?\b/i, suggestedKey: "goliath" },
  { term: "Jötnar", pattern: /\bj[öo]tnar\b/i, suggestedKey: "jotnar" },
  { term: "Halbling", pattern: /\bhalbling(?:e|en|s)?\b/i, suggestedKey: "halbling" },
  { term: "Halfling", pattern: /\bhalfling(?:s)?\b/i, suggestedKey: "halbling" },
  { term: "Mensch", pattern: /\bmensch(?:en|es)?\b/i, suggestedKey: "mensch" },
  { term: "Human", pattern: /\bhumans?\b/i, suggestedKey: "mensch" },
  { term: "Ork", pattern: /\bork(?:e|en|s)?\b/i, suggestedKey: "ork" },
  { term: "Orc", pattern: /\borcs?\b/i, suggestedKey: "ork" },
  { term: "Tiefling", pattern: /\btiefling(?:s)?\b/i, suggestedKey: "tiefling" },
  { term: "Arkadia", pattern: /\barkadia\b/i, suggestedKey: "tiefling" },
  { term: "Goblin", pattern: /\bgoblin(?:s)?\b/i, suggestedKey: "goblinkin", lineageKey: "goblin" },
  { term: "Hobgoblin", pattern: /\bhobgoblin(?:s)?\b/i, suggestedKey: "goblinkin", lineageKey: "hobgoblin" },
  { term: "Bugbear", pattern: /\bbugbear(?:s)?\b/i, suggestedKey: "goblinkin", lineageKey: "bugbear" },
  { term: "Goblinkin", pattern: /\bgoblinkin\b/i, suggestedKey: "goblinkin" },
  { term: "Lizardfolk", pattern: /\blizardfolk\b/i, suggestedKey: "lizardfolk" },
  { term: "Echsenmensch", pattern: /\bechsenmensch(?:en)?\b/i, suggestedKey: "lizardfolk" },
  { term: "Minotaur", pattern: /\bminotaur(?:s|en)?\b/i, suggestedKey: "minotaur" },
  { term: "Centaur", pattern: /\bcentaur(?:s|en)?\b/i, suggestedKey: "centaur" },
  { term: "Fukuro", pattern: /\bfukuro\b/i, suggestedKey: "fukuro" },
  { term: "Felin", pattern: /\bfelin\b/i, suggestedKey: "felin" },
  { term: "Lepoling", pattern: /\blepoling(?:e|en|s)?\b/i, suggestedKey: "lepoling" },
  { term: "Morgawr", pattern: /\bmorgawr\b/i, suggestedKey: "morgawr" },
  { term: "Iso-Tera", pattern: /\biso[\s-]?tera\b/i, suggestedKey: "iso-tera" },
  { term: "Godling", pattern: /\bgodling(?:s)?\b/i, suggestedKey: "godling" },
  { term: "Embeku", pattern: /\bembeku\b/i, suggestedKey: "embeku" },
  { term: "Amphin", pattern: /\bamphin\b/i, suggestedKey: "amphin" },
  { term: "Lamia", pattern: /\blamia\b/i, suggestedKey: "lamia" },
];

function readTerraSeedSource() {
  const terraSeedPath = path.join(repoRoot, "packages/database/src/terra-seed.ts");
  return fs.readFileSync(terraSeedPath, "utf8");
}

function scanText(text, source) {
  /** @type {Array<{ term: string; suggestedKey: string; lineageKey?: string; source: string }>} */
  const hits = [];
  for (const entry of SPECIES_TERMS) {
    if (entry.pattern.test(text)) {
      hits.push({
        term: entry.term,
        suggestedKey: entry.suggestedKey,
        ...(entry.lineageKey ? { lineageKey: entry.lineageKey } : {}),
        source,
      });
    }
  }
  return hits;
}

function flattenBlockContent(blocks) {
  if (!Array.isArray(blocks)) return "";
  return blocks
    .map((b) => {
      if (typeof b?.content === "string") return b.content;
      return "";
    })
    .join("\n");
}

const prisma = createPrismaClient(databaseUrl);

try {
  const worlds = await prisma.world.findMany({ select: { id: true, slug: true, name: true } });
  const terraWorld = worlds.find((w) => w.slug === "terra") ?? null;

  const characterTotal = await prisma.character.count();
  const charactersWithSpecies = await prisma.character.count({
    where: { species: { not: null } },
  });

  const allNpcPages = await prisma.page.findMany({
    where: { type: "npc" },
    select: {
      id: true,
      title: true,
      slug: true,
      worldId: true,
      summary: true,
      contentBlocks: { select: { type: true, content: true, sortOrder: true } },
    },
    orderBy: { title: "asc" },
  });

  const terraNpcPages = terraWorld
    ? allNpcPages.filter((p) => p.worldId === terraWorld.id)
    : [];

  /** @type {Array<{ pageId: string; title: string; slug: string; worldSlug: string | null; hits: typeof SPECIES_TERMS }>} */
  const npcHits = [];

  for (const page of allNpcPages) {
    const worldSlug = worlds.find((w) => w.id === page.worldId)?.slug ?? null;
    const body = [page.title, page.summary ?? "", flattenBlockContent(page.contentBlocks)].join("\n");
    const hits = scanText(body, "page-content");
    if (hits.length > 0) {
      npcHits.push({
        pageId: page.id,
        title: page.title,
        slug: page.slug,
        worldSlug,
        hits,
      });
    }
  }

  const terraSeedSource = readTerraSeedSource();
  const terraSeedHits = scanText(terraSeedSource, "terra-seed.ts");
  const terraSeedNpcTypes = /\btype:\s*["']npc["']/g.test(terraSeedSource);

  const report = {
    scannedAt: new Date().toISOString(),
    database: path.join("packages/database/data/uwe.db"),
    characterSpecies: {
      totalCharacters: characterTotal,
      withSpeciesJson: charactersWithSpecies,
      migrationStatus: characterTotal === 0 ? "N/A — no Character rows to remap" : "pending",
    },
    npcPages: {
      totalAllWorlds: allNpcPages.length,
      totalTerraWorld: terraNpcPages.length,
      terraWorldId: terraWorld?.id ?? null,
      sample: allNpcPages.slice(0, 15).map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        worldSlug: worlds.find((w) => w.id === p.worldId)?.slug ?? null,
      })),
      allTitlesSlugs: allNpcPages.map((p) => ({
        title: p.title,
        slug: p.slug,
        worldSlug: worlds.find((w) => w.id === p.worldId)?.slug ?? null,
      })),
    },
    speciesTermHits: {
      inNpcPageContent: npcHits,
      npcPagesWithHits: npcHits.length,
      inTerraSeedSource: {
        hasNpcPageSeed: terraSeedNpcTypes,
        hits: terraSeedHits,
        note: terraSeedNpcTypes
          ? "terra-seed.ts defines NPC pages"
          : "terra-seed.ts defines no Page.type=npc entries (locations/regions/factions only)",
      },
    },
    catalogKeyPolicy: {
      legacySrdKeysRetained: true,
      mergedAsExistingSrd: [
        "drachenblutige",
        "zwerg",
        "elf",
        "gnom",
        "goliath",
        "halbling",
        "mensch",
        "ork",
        "tiefling",
      ],
      duplicateRewrittenEntries: false,
      keyDeletionApplicable: false,
      reason:
        "No Character.species rows and NPCs lack structured species JSON; legacy catalog keys stay in SPECIES_SRD — no duplicate rewritten entries to remove.",
    },
    nextSteps: [
      "Optional later: manual wiki prose review when Terra NPC corpus grows",
      "Structured species on NPC pages remains out of scope for Phase 1",
    ],
  };

  const outPath = path.join(scriptDir, "npc-species-scan.json");
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
} finally {
  await disconnectPrismaClientIfOwned(prisma);
}
