/**
 * Gouache asset registry — metadata only.
 *
 * The AI proposal validators need exactly two things from the Gouache asset
 * engine: the list of legal asset keys (allowlist for `validateAtlasPlotFill-
 * Proposal`) and the key/name/category triples that go into the prompt
 * context. They never draw anything.
 *
 * The former home (`@uwe/atlas/assets`) mixed this pure metadata with ~1.100
 * lines of `CanvasRenderingContext2D` recipes spread over `assets.ts`,
 * `assets-batch4.ts`, `assets-batch5.ts`, `assets-toolkit.ts` and `prng.ts`.
 * Only the metadata is part of the AI interface, so only the metadata moved.
 *
 * Order is significant: it is the palette order and it is what the prompt
 * context lists. `key` values are persisted in `AtlasObject.style.gouache` —
 * never rename a key.
 */

export type GouacheCategory =
  | "flora"
  | "structure"
  | "landmark"
  | "vehicle"
  | "market"
  | "prop";

export interface GouacheAsset {
  /** Stable key persisted in `AtlasObject.style.gouache`. Never rename. */
  key: string;
  /** German display name for the palette. */
  name: string;
  /** Grouping for the palette. */
  category: GouacheCategory;
}

export const GOUACHE_CATEGORY_LABELS: Record<GouacheCategory, string> = {
  flora: "Flora",
  structure: "Bauwerke",
  landmark: "Landmarken",
  vehicle: "Fahrzeuge",
  market: "Markt",
  prop: "Deko",
};

/** Canonical, ordered gouache asset registry (metadata only). */
export const GOUACHE_ASSETS: readonly GouacheAsset[] = [
  { key: "g_oak", name: "Eiche", category: "flora" },
  { key: "g_pine", name: "Nadelbaum", category: "flora" },
  { key: "g_bush", name: "Busch", category: "flora" },
  { key: "g_mushroom", name: "Riesenpilz", category: "flora" },
  { key: "g_house", name: "Haus", category: "structure" },
  { key: "g_tower", name: "Turm", category: "structure" },
  { key: "g_keep", name: "Bergfried", category: "structure" },
  { key: "g_church", name: "Kirche", category: "structure" },
  { key: "g_windmill", name: "Windmühle", category: "structure" },
  { key: "g_watermill", name: "Wassermühle", category: "structure" },
  { key: "g_tent", name: "Zelt", category: "structure" },
  { key: "g_ruin", name: "Ruine", category: "structure" },
  { key: "g_signal_tower", name: "Signalturm", category: "structure" },
  { key: "g_bridge", name: "Steinbrücke", category: "structure" },
  { key: "g_lighthouse", name: "Leuchtturm", category: "structure" },
  { key: "g_amphitheater", name: "Amphitheater", category: "structure" },
  { key: "g_burial_mound", name: "Grabhügel", category: "structure" },
  { key: "g_caravanserai", name: "Karawanserei", category: "structure" },
  { key: "g_pyramid", name: "Pyramide", category: "landmark" },
  { key: "g_obelisk", name: "Obelisk", category: "landmark" },
  { key: "g_cave_mouth", name: "Höhleneingang", category: "landmark" },
  { key: "g_magic_crystal", name: "Magiekristall", category: "landmark" },
  { key: "g_stone_circle", name: "Steinkreis", category: "landmark" },
  { key: "g_floating_island", name: "Fliegende Insel", category: "landmark" },
  { key: "g_turtle_castle", name: "Schildkröten-Schloss", category: "landmark" },
  { key: "g_ziggurat", name: "Ziggurat", category: "landmark" },
  { key: "g_portal_arch", name: "Portalbogen", category: "landmark" },
  { key: "g_ship", name: "Schiff", category: "vehicle" },
  { key: "g_cart", name: "Pferdekarren", category: "vehicle" },
  { key: "g_airship", name: "Flugschiff", category: "vehicle" },
  { key: "g_stall", name: "Marktstand", category: "market" },
  { key: "g_well", name: "Brunnen", category: "prop" },
  // --- batch 4 (was `assets-batch4.ts`) ---
  { key: "g_giant_mushroom", name: "Titanenpilz", category: "flora" },
  { key: "g_smithy", name: "Schmiede", category: "structure" },
  { key: "g_wizard_tower", name: "Zauberturm", category: "landmark" },
  { key: "g_dragon_perch", name: "Drachenhorst", category: "landmark" },
  { key: "g_waterfall", name: "Wasserfall", category: "landmark" },
  { key: "g_shipwreck", name: "Schiffswrack", category: "vehicle" },
  { key: "g_hot_spring", name: "Heiße Quelle", category: "prop" },
  { key: "g_shrine", name: "Wegschrein", category: "prop" },
  // --- batch 5 (was `assets-batch5.ts`) ---
  { key: "g_mountain", name: "Berg", category: "landmark" },
  { key: "g_mountain_snow", name: "Schneeberg", category: "landmark" },
  { key: "g_hill", name: "Hügel", category: "landmark" },
  { key: "g_volcano", name: "Vulkan", category: "landmark" },
  { key: "g_mountain_range", name: "Gebirgskette", category: "landmark" },
  { key: "g_cliff", name: "Klippe", category: "landmark" },
  { key: "g_rock", name: "Fels", category: "prop" },
  { key: "g_cloud", name: "Wolke", category: "prop" },
  { key: "g_lake", name: "See", category: "landmark" },
  { key: "g_grass_tuft", name: "Grasbüschel", category: "flora" },
  { key: "g_swamp_tuft", name: "Sumpf", category: "flora" },
  { key: "g_dunes", name: "Dünen", category: "landmark" },
  { key: "g_beanstalk", name: "Bohnenranke", category: "flora" },
  { key: "g_giant_root", name: "Weltenwurzel", category: "flora" },
  { key: "g_city", name: "Stadt", category: "structure" },
  { key: "g_harbor", name: "Hafen", category: "structure" },
  { key: "g_temple", name: "Tempel", category: "structure" },
  { key: "g_wall", name: "Stadtmauer", category: "structure" },
  { key: "g_gate", name: "Stadttor", category: "structure" },
  { key: "g_root_knot", name: "Wurzelknoten", category: "prop" },
] as const;

export const GOUACHE_ASSET_KEYS: readonly string[] = GOUACHE_ASSETS.map(
  (a) => a.key,
);
