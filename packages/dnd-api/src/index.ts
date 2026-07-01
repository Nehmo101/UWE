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

export async function searchDnd5eSrd(
  resource: "monsters" | "spells" | "equipment",
  query: string,
  options: DndApiClientOptions = {},
): Promise<DndApiSearchResult[]> {
  if (options.dnd5eSrdEnabled === false) return [];
  const timeout = options.timeoutMs ?? 10000;
  const url = `${DND5E_SRD_BASE}/${resource}`;
  const data = await fetchJson<Dnd5eListResponse>(url, timeout);
  const lower = query.toLowerCase();
  return data.results
    .filter((item) => item.name.toLowerCase().includes(lower))
    .slice(0, 20)
    .map((item) => ({
      provider: "dnd5e_srd" as const,
      id: item.index,
      name: item.name,
      url: `${DND5E_SRD_BASE.replace("/api", "")}${item.url}`,
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
  return fetchJson(`${DND5E_SRD_BASE}${normalized}`, options.timeoutMs ?? 10000);
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

export { formatOpen5eMonsterAsMarkdown } from "./statblock-format";
export { buildEncounterMarkdown, type EncounterMonsterInput } from "./encounter-builder";
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
