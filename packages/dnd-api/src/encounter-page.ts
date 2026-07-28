/**
 * Domain logic for turning DnD-API data into Studio pages: slug-collision
 * resolution, Page/ContentBlock assembly and the encounter-generator
 * candidate orchestration.
 *
 * The repository is injected (dependency injection) so this package stays
 * free of an `@uwe/database` import — see the structural interfaces below.
 */
import { formatOpen5eMonsterAsMarkdown } from "./statblock-format";
import { buildEncounterMarkdown, type EncounterMonsterInput } from "./encounter-builder";
import { analyzeEncounterXp } from "./encounter-xp-budget";
import type { EncounterCandidate, EncounterComposition } from "./encounter-composer";

/** Minimal Page/ContentBlock shape needed to create a page. */
export interface DndCreatePageInput {
  worldId: string;
  title: string;
  slug: string;
  type: "monster" | "encounter";
  summary: string;
  contentBlocks: Array<{
    type: "statblock" | "rich_text";
    sortOrder: number;
    content: string;
  }>;
}

/** Repository surface for slug-collision checks (injected). */
export interface PageSlugLookup {
  getPageBySlug(worldSlug: string, pageSlug: string): Promise<unknown>;
}

/** Repository surface needed to create a page (injected). */
export interface DndPageRepository<TPage> extends PageSlugLookup {
  createPage(input: DndCreatePageInput): Promise<TPage>;
}

/**
 * Resolves a collision-free page slug within a world by appending an
 * incrementing counter (`base`, `base-2`, `base-3`, …). `base` must already
 * be slugified by the caller.
 */
export async function resolveUniquePageSlug(
  repo: PageSlugLookup,
  worldSlug: string,
  base: string,
): Promise<string> {
  let candidate = base;
  let counter = 2;
  while (await repo.getPageBySlug(worldSlug, candidate)) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }
  return candidate;
}

/** Assembles the DM-only monster page for an imported Open5e statblock. */
export function buildStatblockPageInput(input: {
  worldId: string;
  open5eSlug: string;
  title: string;
  pageSlug: string;
  markdown: string;
}): DndCreatePageInput {
  return {
    worldId: input.worldId,
    title: input.title,
    slug: input.pageSlug,
    type: "monster",
    summary: `Open5e Statblock (${input.open5eSlug})`,
    contentBlocks: [
      {
        type: "statblock",
        sortOrder: 0,
        content: input.markdown,
      },
    ],
  };
}

/** Assembles the DM-only encounter page from prepared markdown. */
export function buildEncounterPageInput(input: {
  worldId: string;
  title: string;
  pageSlug: string;
  markdown: string;
  summary: string;
}): DndCreatePageInput {
  return {
    worldId: input.worldId,
    title: input.title,
    slug: input.pageSlug,
    type: "encounter",
    summary: input.summary,
    contentBlocks: [
      {
        type: "rich_text",
        sortOrder: 0,
        content: input.markdown,
      },
    ],
  };
}

export interface ImportStatblockInput {
  worldId: string;
  worldSlug: string;
  open5eSlug: string;
  title?: string | null;
  /** Raw Open5e monster payload (fetched by the caller). */
  monster: unknown;
  /** Slugifier (e.g. `slugifyPageTitle` from the app), injected. */
  slugify: (title: string) => string;
}

/**
 * Imports an Open5e statblock as a DM-only monster page: derives the title,
 * formats the markdown, resolves a unique slug and creates the page.
 */
export async function importOpen5eStatblockPage<TPage>(
  repo: DndPageRepository<TPage>,
  input: ImportStatblockInput,
): Promise<TPage> {
  const monsterRecord = input.monster as Record<string, unknown>;
  const title =
    input.title?.trim() ||
    (typeof monsterRecord.name === "string" ? monsterRecord.name : input.open5eSlug);
  const markdown = formatOpen5eMonsterAsMarkdown(input.monster);
  const base = input.slugify(`${title}-${input.open5eSlug}`);
  const pageSlug = await resolveUniquePageSlug(repo, input.worldSlug, base);

  return repo.createPage(
    buildStatblockPageInput({
      worldId: input.worldId,
      open5eSlug: input.open5eSlug,
      title,
      pageSlug,
      markdown,
    }),
  );
}

export interface CreateEncounterPageInput {
  worldId: string;
  worldSlug: string;
  title?: string | null;
  partyLevel?: number;
  partySize?: number;
  monsters: EncounterMonsterInput[];
  /** Slugifier (e.g. `slugifyPageTitle` from the app), injected. */
  slugify: (title: string) => string;
}

/**
 * Creates a DM-only encounter page from a monster list, computing the XP
 * analysis (when party size/level are known), markdown, summary and a unique
 * slug.
 */
export async function createEncounterPage<TPage>(
  repo: DndPageRepository<TPage>,
  input: CreateEncounterPageInput,
): Promise<TPage> {
  const title = input.title?.trim() || "Encounter";
  const analysis =
    input.partyLevel && input.partySize
      ? analyzeEncounterXp({
          partyLevel: input.partyLevel,
          partySize: input.partySize,
          monsters: input.monsters.map((monster) => ({
            cr: monster.cr,
            count: monster.count ?? 1,
          })),
        })
      : undefined;
  const markdown = buildEncounterMarkdown(input.monsters, analysis);
  const base = input.slugify(`${title}-encounter`);
  const pageSlug = await resolveUniquePageSlug(repo, input.worldSlug, base);
  const summary = `${input.monsters.reduce((sum, monster) => sum + (monster.count ?? 1), 0)} Monster`;

  return repo.createPage(
    buildEncounterPageInput({
      worldId: input.worldId,
      title,
      pageSlug,
      markdown,
      summary,
    }),
  );
}

/**
 * Gathers encounter candidates across CR buckets. `loadBucket` encapsulates
 * how one bucket is loaded (e.g. the route's cache-aside over the Open5e API),
 * keeping the DB cache in the caller while the fan-out/flatten lives here.
 */
export async function gatherEncounterCandidates(
  crBuckets: string[],
  loadBucket: (cr: string) => Promise<EncounterCandidate[]>,
): Promise<EncounterCandidate[]> {
  const buckets = await Promise.all(crBuckets.map((cr) => loadBucket(cr)));
  return buckets.flat();
}

/** Serializes a composition into the encounter-generator response shape. */
export function serializeEncounterComposition(composition: EncounterComposition) {
  return {
    style: composition.style,
    targetXp: composition.targetXp,
    capXp: composition.capXp,
    analysis: composition.analysis,
    monsters: composition.entries.map((entry) => ({
      name: entry.monster.name,
      slug: entry.monster.slug,
      cr: entry.monster.cr,
      count: entry.count,
    })),
  };
}
