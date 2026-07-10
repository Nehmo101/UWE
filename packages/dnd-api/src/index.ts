/**
 * DnD API clients — Open5e and D&D 5e SRD API.
 * No D&D Beyond scraping; manual link storage is in @uwe/database.
 */

export type DndApiProviderId = "open5e" | "dnd5e_srd";

export interface DndApiSearchResult {
  provider: DndApiProviderId;
  id: string;
  name: string;
  url: string;
  summary?: string;
  raw?: unknown;
}

export interface DndApiClientOptions {
  open5eEnabled?: boolean;
  dnd5eSrdEnabled?: boolean;
  timeoutMs?: number;
}

const OPEN5E_BASE = "https://api.open5e.com";
const OPEN5E_V1_BASE = `${OPEN5E_BASE}/v1`;
const DND5E_SRD_BASE = "https://www.dnd5eapi.co/api";

async function fetchJson<T>(url: string, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`DnD-API-Anfrage fehlgeschlagen (${response.status}): ${url}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

interface Open5eListResponse {
  results: Array<{ slug: string; name: string; desc?: string; [key: string]: unknown }>;
}

interface Dnd5eListResponse {
  results: Array<{ index: string; name: string; url: string }>;
}

export async function searchOpen5eMonsters(
  query: string,
  options: DndApiClientOptions = {},
): Promise<DndApiSearchResult[]> {
  if (options.open5eEnabled === false) return [];
  const timeout = options.timeoutMs ?? 10000;
  const url = `${OPEN5E_BASE}/monsters/?search=${encodeURIComponent(query)}`;
  const data = await fetchJson<Open5eListResponse>(url, timeout);
  return data.results.slice(0, 20).map((item) => ({
    provider: "open5e" as const,
    id: item.slug,
    name: item.name,
    url: `${OPEN5E_BASE}/monsters/${item.slug}/`,
    summary: typeof item.desc === "string" ? item.desc.slice(0, 200) : undefined,
    raw: item,
  }));
}

export interface Open5eMonsterByCr {
  name: string;
  slug: string;
  cr: string;
}

/** Lists Open5e monsters of one challenge rating (for the encounter composer). */
export async function listOpen5eMonstersByChallengeRating(
  cr: string,
  options: DndApiClientOptions = {},
): Promise<Open5eMonsterByCr[]> {
  if (options.open5eEnabled === false) return [];
  const timeout = options.timeoutMs ?? 10000;
  const url = `${OPEN5E_BASE}/monsters/?challenge_rating=${encodeURIComponent(cr)}&limit=50`;
  const data = await fetchJson<Open5eListResponse>(url, timeout);
  return data.results.slice(0, 50).map((item) => ({
    name: item.name,
    slug: item.slug,
    cr,
  }));
}

export async function searchOpen5eSpells(
  query: string,
  options: DndApiClientOptions = {},
): Promise<DndApiSearchResult[]> {
  if (options.open5eEnabled === false) return [];
  const timeout = options.timeoutMs ?? 10000;
  const url = `${OPEN5E_BASE}/spells/?search=${encodeURIComponent(query)}`;
  const data = await fetchJson<Open5eListResponse>(url, timeout);
  return data.results.slice(0, 20).map((item) => ({
    provider: "open5e" as const,
    id: item.slug,
    name: item.name,
    url: `${OPEN5E_BASE}/spells/${item.slug}/`,
    raw: item,
  }));
}

/** Lists Open5e spells for one spell level (SRD catalog import). */
export async function listOpen5eSpellsByLevel(
  level: number,
  options: DndApiClientOptions = {},
): Promise<DndApiSearchResult[]> {
  if (options.open5eEnabled === false) return [];
  const safeLevel = Math.max(0, Math.min(9, Math.floor(level)));
  const timeout = options.timeoutMs ?? 10000;
  const url = `${OPEN5E_BASE}/spells/?level_int=${safeLevel}&limit=100`;
  const data = await fetchJson<Open5eListResponse>(url, timeout);
  return data.results.map((item) => ({
    provider: "open5e" as const,
    id: item.slug,
    name: item.name,
    url: `${OPEN5E_BASE}/spells/${item.slug}/`,
    raw: item,
  }));
}

export type Open5eEquipmentKind = "weapon" | "magicitem";

export type Open5eEquipmentResource = "weapons" | "magicitems";

async function searchOpen5eEquipmentResource(
  resource: Open5eEquipmentResource,
  query: string,
  options: DndApiClientOptions = {},
): Promise<DndApiSearchResult[]> {
  if (options.open5eEnabled === false) return [];
  const timeout = options.timeoutMs ?? 10000;
  const path = resource === "weapons" ? "weapons" : "magicitems";
  const url = `${OPEN5E_V1_BASE}/${path}/?search=${encodeURIComponent(query)}`;
  const data = await fetchJson<Open5eListResponse>(url, timeout);
  const kind: Open5eEquipmentKind = resource === "weapons" ? "weapon" : "magicitem";
  return data.results.slice(0, 15).map((item) => ({
    provider: "open5e" as const,
    id: `${kind}:${item.slug}`,
    name: item.name,
    url: `${OPEN5E_V1_BASE}/${path}/${item.slug}/`,
    summary:
      kind === "magicitem" && typeof item.desc === "string"
        ? item.desc.slice(0, 200)
        : undefined,
    raw: { ...item, equipmentKind: kind },
  }));
}

export async function searchOpen5eEquipment(
  query: string,
  options: DndApiClientOptions = {},
): Promise<DndApiSearchResult[]> {
  const [weapons, magicItems] = await Promise.all([
    searchOpen5eEquipmentResource("weapons", query, options).catch(() => []),
    searchOpen5eEquipmentResource("magicitems", query, options).catch(() => []),
  ]);
  return [...weapons, ...magicItems].slice(0, 20);
}

export async function getOpen5eEquipment(
  kind: Open5eEquipmentKind,
  slug: string,
  options: DndApiClientOptions = {},
): Promise<unknown> {
  if (options.open5eEnabled === false) {
    throw new Error("Open5e API ist deaktiviert.");
  }
  const path = kind === "weapon" ? "weapons" : "magicitems";
  return fetchJson(
    `${OPEN5E_V1_BASE}/${path}/${encodeURIComponent(slug)}/`,
    options.timeoutMs ?? 10000,
  );
}

export async function searchEquipment(
  query: string,
  options: DndApiClientOptions = {},
): Promise<DndApiSearchResult[]> {
  const [open5e, srd] = await Promise.all([
    searchOpen5eEquipment(query, options).catch(() => []),
    searchDnd5eSrd("equipment", query, options).catch(() => []),
  ]);
  const seen = new Set<string>();
  const merged: DndApiSearchResult[] = [];
  for (const item of [...open5e, ...srd]) {
    const key = `${item.provider}:${item.id}:${item.name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
    if (merged.length >= 20) break;
  }
  return merged;
}

export async function searchDnd5eSrd(
  resource: "monsters" | "spells" | "equipment",
  query: string,
  options: DndApiClientOptions = {},
): Promise<DndApiSearchResult[]> {
  if (options.dnd5eSrdEnabled === false) return [];
  const timeout = options.timeoutMs ?? 10000;
  const url =
    resource === "equipment"
      ? `${DND5E_SRD_BASE}/2014/equipment`
      : `${DND5E_SRD_BASE}/${resource}`;
  const data = await fetchJson<Dnd5eListResponse>(url, timeout);
  const lower = query.toLowerCase();
  return data.results
    .filter((item) => item.name.toLowerCase().includes(lower))
    .slice(0, 20)
    .map((item) => ({
      provider: "dnd5e_srd" as const,
      id: item.index,
      name: item.name,
      url: `${DND5E_SRD_BASE.replace("/api", "")}${item.url.replace(/^\/api/, "/api/2014")}`,
      raw: item,
    }));
}

export async function getOpen5eMonster(
  slug: string,
  options: DndApiClientOptions = {},
): Promise<unknown> {
  if (options.open5eEnabled === false) {
    throw new Error("Open5e API ist deaktiviert.");
  }
  return fetchJson(`${OPEN5E_BASE}/monsters/${encodeURIComponent(slug)}/`, options.timeoutMs ?? 10000);
}

export async function getDnd5eResource(
  path: string,
  options: DndApiClientOptions = {},
): Promise<unknown> {
  if (options.dnd5eSrdEnabled === false) {
    throw new Error("D&D 5e SRD API ist deaktiviert.");
  }
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const apiPath = normalized.startsWith("/2014") ? normalized : `/2014${normalized}`;
  return fetchJson(`${DND5E_SRD_BASE}${apiPath}`, options.timeoutMs ?? 10000);
}

export async function searchAllDndApis(
  query: string,
  options: DndApiClientOptions = {},
): Promise<DndApiSearchResult[]> {
  const [monsters, spells, srdMonsters] = await Promise.all([
    searchOpen5eMonsters(query, options).catch(() => []),
    searchOpen5eSpells(query, options).catch(() => []),
    searchDnd5eSrd("monsters", query, options).catch(() => []),
  ]);
  return [...monsters, ...spells, ...srdMonsters];
}

export {
  formatDnd5eSrdEquipmentAsMarkdown,
  formatOpen5eEquipmentAsMarkdown,
  summarizeOpen5eEquipment,
} from "./equipment-format";
export { formatOpen5eMonsterAsMarkdown } from "./statblock-format";
export { buildEncounterMarkdown, type EncounterMonsterInput } from "./encounter-builder";
export {
  buildEncounterPageInput,
  buildStatblockPageInput,
  createEncounterPage,
  gatherEncounterCandidates,
  importOpen5eStatblockPage,
  resolveUniquePageSlug,
  serializeEncounterComposition,
  type CreateEncounterPageInput,
  type DndCreatePageInput,
  type DndPageRepository,
  type ImportStatblockInput,
  type PageSlugLookup,
} from "./encounter-page";
export {
  challengeRatingForXp,
  ORDERED_CHALLENGE_RATINGS,
  suggestCandidateChallengeRatings,
  suggestEncounterComposition,
  type EncounterCandidate,
  type EncounterComposition,
  type EncounterCompositionEntry,
  type EncounterCompositionInput,
  type EncounterStyle,
  type EncounterTargetDifficulty,
} from "./encounter-composer";
export {
  analyzeEncounterXp,
  ENCOUNTER_DIFFICULTY_LABELS,
  encounterMultiplier,
  getEncounterBudgetThresholds,
  normalizeChallengeRating,
  xpForChallengeRating,
  type EncounterBudgetThresholds,
  type EncounterDifficultyBand,
  type EncounterXpAnalysis,
} from "./encounter-xp-budget";
export {
  exportStructuredStatblockFiveTools,
  exportStructuredStatblockHomebrewery,
  exportStructuredStatblockJson,
} from "./statblock-structured-export";
export {
  abilityModifier,
  createEmptyStatblockDraft,
  formatAbilityModifier,
  STATBLOCK_ABILITY_KEYS,
  STATBLOCK_ENTRY_SECTIONS,
  statblockDraftFromData,
  statblockDraftToData,
  validateStatblockDraft,
  type StatblockAbilityKey,
  type StatblockAbilityScores,
  type StatblockEntryDraft,
  type StatblockEntrySection,
  type StructuredStatblockDraft,
  type StructuredStatblockDraftResult,
} from "./statblock-structured-model";
