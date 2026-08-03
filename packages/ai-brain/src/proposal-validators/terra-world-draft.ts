/**
 * Review-only AI proposal shape for a whole Terra map ("J4").
 *
 * The model may suggest GENERATOR PARAMETERS, never geometry. Terra's
 * deterministic world generator (`terra/src/generators/welt.js`,
 * `erzeugeWelt(seed, opt)`) owns height field, placement rules, coordinates,
 * element seeds and persistence. Same parameters + same seed => same map;
 * that promise is the reason this validator hands out numbers and enum
 * members only.
 *
 * Difference to its siblings (`plot-fill-proposal.ts`, `engine-asset-proposal.ts`):
 * those REJECT a malformed proposal. This one CLAMPS. A world draft that
 * fails validation would leave the user with nothing; a clamped one leaves
 * them with a boring map they can edit. Only four things are fatal — a
 * non-object, an unknown `kind`, an unknown `schemaVersion`, and executable
 * payload anywhere in the tree. Everything else is corrected and reported in
 * `notices`, so the UI can show what the model was not allowed to say.
 *
 * Field names are German because they ARE Terra's option names
 * (`WELT_STANDARD` in welt.js, `S.biom` / `S.klima` / `S.sprachfamilie` /
 * `S.einheitMeter` in core/store.js). Renaming them here would create a second
 * vocabulary that has to be translated twice and drifts once.
 *
 * The counted fields (`fluesse`, `siedlungen`, `waelder`, `wiesen`) are WISHES
 * in whole units, not the density factors `erzeugeWelt` takes. The conversion
 * lives on the Terra side (`terra/src/generators/welt-vorgabe.js`), because
 * the formula that turns a count into a factor depends on the map size and
 * belongs next to the generator it feeds.
 */

export const TERRA_WORLD_DRAFT_KIND = "terra_world_draft" as const;
export const TERRA_WORLD_DRAFT_SCHEMA_VERSION = 1 as const;

/**
 * Terra's biome registry keys (`BIOME` in terra/src/core/store.js).
 * Mirrored, not imported: `@uwe/ai-brain` must not depend on the browser
 * editor. `terra/test/13-welt-vorgabe.test.mjs` compares both lists and fails
 * on drift.
 */
export const TERRA_BIOME = [
  "wiese", "wueste", "kueste", "sumpf", "schnee", "eis", "moor", "meer",
  "hochland", "steppe", "vulkan", "salzwueste", "regenwald", "bambuswald",
  "mangrove", "kreide", "tundra", "karst", "bluetental", "aschebrache",
  "pilzwald", "terrassen", "nebelwald", "klippenmeer", "korallenbank", "luftarchipel",
] as const;
export type TerraBiome = (typeof TERRA_BIOME)[number];

/** `KARTEN_GROESSEN` in terra/src/core/store.js. */
export const TERRA_KARTEN_GROESSEN = [256, 512, 1024] as const;
export type TerraKartenGroesse = (typeof TERRA_KARTEN_GROESSEN)[number];

/** `FAMILIEN_IDS` in terra/src/generators/namen.js, plus "auto". */
export const TERRA_SPRACHFAMILIEN = [
  "auto", "dorf", "klassisch", "zwergisch", "elfisch", "arbor", "neutral",
] as const;
export type TerraSprachfamilie = (typeof TERRA_SPRACHFAMILIEN)[number];

/** Values of `BIOM_STIL` in terra/src/generators/welt.js. */
export const TERRA_BAUSTILE = [
  "dorf", "klassisch", "zwergisch", "elfisch", "werk", "ruine",
] as const;
export type TerraBaustil = (typeof TERRA_BAUSTILE)[number];

/** `PRESETS` in terra/src/world/atmosphere.js. */
export const TERRA_TAGESZEITEN = ["morgen", "mittag", "abend", "nebel", "nacht"] as const;
export type TerraTageszeit = (typeof TERRA_TAGESZEITEN)[number];

/** `WETTER` in terra/src/world/atmosphere.js. */
export const TERRA_WETTER = ["klar", "bewoelkt", "regen", "schneefall", "sturm"] as const;
export type TerraWetter = (typeof TERRA_WETTER)[number];

/**
 * Upper bounds of the counted wishes. They are the generator's own hard caps
 * (`clamp(..., 0, 14)` for settlements, `0..12` rivers, `0..26` forests,
 * `0..20` meadows, `0..5` Arbor vines) — asking for more is not ambition, it
 * is a misunderstanding, and the generator would silently drop it anyway.
 */
export const TERRA_MAX = {
  fluesse: 12,
  siedlungen: 14,
  waelder: 26,
  wiesen: 20,
  ranken: 5,
} as const;

/** One accepted, fully resolved parameter set. No optional numeric fields:
 *  whatever the model omitted is filled from the defaults below, so the Terra
 *  side never has to guess and the persisted draft is complete. */
export interface TerraWorldDraft {
  schemaVersion: typeof TERRA_WORLD_DRAFT_SCHEMA_VERSION;
  kind: typeof TERRA_WORLD_DRAFT_KIND;
  biom: TerraBiome;
  kartenGroesse: TerraKartenGroesse;
  /** World metres per grid cell (`S.einheitMeter`). */
  einheitMeter: number;
  /** Climate axis (`S.klima`): direction in degrees, gradient, base warmth. */
  klima: { richtung: number; staerke: number; grund: number; hoeheKuehl: number };
  /**
   * Wished relief emphasis — "mountains in the north". Direction in Terra's
   * compass degrees (0 = north). `genBase` has no bias term, so Terra answers
   * this with a deterministic seed search instead of a terrain change;
   * `staerke: 0` switches the search off.
   */
  relief: { richtung: number; staerke: number };
  /** Wished counts, not factors. See the module comment. */
  fluesse: number;
  siedlungen: number;
  waelder: number;
  wiesen: number;
  ranken: number;
  strassen: boolean;
  /** Build style; null means "derive from the biome" (`BIOM_STIL`). */
  stil: TerraBaustil | null;
  sprachfamilie: TerraSprachfamilie;
  tageszeit: TerraTageszeit;
  wetter: TerraWetter;
  /** Free names. Empty arrays are normal — Terra's name generator fills in. */
  namen: {
    region: string | null;
    orte: string[];
    fluesse: string[];
    waelder: string[];
    ranken: string[];
  };
  /** One sentence of model reasoning, shown to the user. Never executed. */
  notizen?: string;
}

export const TERRA_WORLD_DRAFT_STANDARD: TerraWorldDraft = {
  schemaVersion: TERRA_WORLD_DRAFT_SCHEMA_VERSION,
  kind: TERRA_WORLD_DRAFT_KIND,
  biom: "wiese",
  kartenGroesse: 256,
  einheitMeter: 1,
  klima: { richtung: 0, staerke: 0.5, grund: 0.5, hoeheKuehl: 0.012 },
  relief: { richtung: 0, staerke: 0 },
  fluesse: 4,
  siedlungen: 4,
  waelder: 7,
  wiesen: 5,
  ranken: 3,
  strassen: true,
  stil: null,
  sprachfamilie: "auto",
  tageszeit: "mittag",
  wetter: "klar",
  namen: { region: null, orte: [], fluesse: [], waelder: [], ranken: [] },
};

export type TerraWorldDraftNoticeCode =
  | "clamped"
  | "defaulted"
  | "rejected"
  | "dropped"
  | "invalid_type"
  | "unexpected_field"
  | "executable_code";

export interface TerraWorldDraftNotice {
  path: string;
  code: TerraWorldDraftNoticeCode;
  message: string;
}

export type TerraWorldDraftResult =
  | { ok: true; draft: TerraWorldDraft; notices: TerraWorldDraftNotice[] }
  | { ok: false; errors: TerraWorldDraftNotice[] };

export interface TerraWorldDraftPromptContext {
  schemaVersion: typeof TERRA_WORLD_DRAFT_SCHEMA_VERSION;
  kind: typeof TERRA_WORLD_DRAFT_KIND;
  biome: readonly string[];
  kartenGroessen: readonly number[];
  sprachfamilien: readonly string[];
  baustile: readonly string[];
  tageszeiten: readonly string[];
  wetter: readonly string[];
  rules: string[];
}

/* --------------------------------------------------------------------------
   Shared shape checks. Deliberately the same wording and structure as
   plot-fill-proposal.ts — two validators that look alike are read alike.
   -------------------------------------------------------------------------- */

const TOP_LEVEL_KEYS = [
  "schemaVersion", "kind", "biom", "kartenGroesse", "einheitMeter", "klima",
  "relief", "fluesse", "siedlungen", "waelder", "wiesen", "ranken", "strassen",
  "stil", "sprachfamilie", "tageszeit", "wetter", "namen", "notizen",
] as const;

const KLIMA_KEYS = ["richtung", "staerke", "grund", "hoeheKuehl"] as const;
const RELIEF_KEYS = ["richtung", "staerke"] as const;
const NAMEN_KEYS = ["region", "orte", "fluesse", "waelder", "ranken"] as const;

const EXECUTABLE_KEYS = new Set([
  "code", "sourcecode", "script", "javascript", "typescript", "jsx", "tsx",
  "executable", "functionbody", "renderfunction", "drawfunction",
  // Terra-specific: the model must never hand over geometry or elements.
  "elemente", "elements", "points", "punkte", "hoehen", "hoehendelta",
  "koordinaten", "coordinates", "polygon", "geometry", "geometrie",
]);

const EXECUTABLE_TEXT = [
  /<\s*script\b/i,
  /\b(?:function|class)\s+[A-Za-z_$]/,
  /=>/,
  /\bimport\s+(?:type\s+)?(?:\{|[A-Za-z_$*])/,
  /\bexport\s+(?:default|function|class|const|let|var|\{|\*)/,
  /\b(?:eval|Function|setTimeout|setInterval)\s*\(/,
  /\b(?:require|process|child_process|Deno)\b/,
];

/**
 * Allowed characters in a free name. Allow-list, not deny-list — the attitude
 * of `zielPruefen` in terra/src/ui/beschriftung.js. Letters (including the
 * umlauts and accents Terra's own generator produces), digits, and the three
 * separators a place name legitimately carries. No control characters, no
 * zero-width or bidi marks, no punctuation that could be read as markup.
 */
const NAME_LETTER = "A-Za-z0-9\\u00c0-\\u00d6\\u00d8-\\u00f6\\u00f8-\\u024f";
const NAME_MUSTER = new RegExp(
  `^[${NAME_LETTER}]+(?:[ \\u2019'-][${NAME_LETTER}]+)*$`,
);
const NAME_MAX = 48;
/** Enough for the largest map's elements; a longer list is a runaway model. */
const NAME_LISTE_MAX = 26;
const NOTIZ_MAX = 400;

function add(
  list: TerraWorldDraftNotice[],
  path: string,
  code: TerraWorldDraftNoticeCode,
  message: string,
): void {
  list.push({ path, code, message });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function scanExecutable(
  value: unknown,
  path: string,
  errors: TerraWorldDraftNotice[],
  seen = new WeakSet<object>(),
): void {
  if (typeof value === "function") {
    add(errors, path, "executable_code", "Function values are not accepted.");
    return;
  }
  if (typeof value === "string") {
    if (EXECUTABLE_TEXT.some((pattern) => pattern.test(value))) {
      add(errors, path, "executable_code", "Executable source text is not accepted.");
    }
    return;
  }
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanExecutable(entry, `${path}[${index}]`, errors, seen));
    return;
  }
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (EXECUTABLE_KEYS.has(key.toLowerCase())) {
      add(
        errors,
        `${path}.${key}`,
        "executable_code",
        `Field "${key}" carries code or geometry and is not accepted.`,
      );
    }
    scanExecutable(entry, `${path}.${key}`, errors, seen);
  }
}

function noteUnknown(
  obj: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  notices: TerraWorldDraftNotice[],
): void {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) {
      add(notices, `${path}.${key}`, "unexpected_field", `Unknown field "${key}" ignored.`);
    }
  }
}

/* --------------------------------------------------------------------------
   Clamping readers. Every one of them returns a usable value; the notice
   explains what the model lost.
   -------------------------------------------------------------------------- */

function zahl(
  raw: Record<string, unknown>,
  key: string,
  path: string,
  fallback: number,
  min: number,
  max: number,
  notices: TerraWorldDraftNotice[],
  opts: { integer?: boolean } = {},
): number {
  const value = raw[key];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    add(notices, `${path}.${key}`, "invalid_type", `${key} is not a finite number — default ${fallback} used.`);
    return fallback;
  }
  let out = opts.integer ? Math.round(value) : value;
  if (out < min || out > max) {
    const geklemmt = Math.min(max, Math.max(min, out));
    add(notices, `${path}.${key}`, "clamped", `${key} ${out} is outside ${min}..${max} — clamped to ${geklemmt}.`);
    out = geklemmt;
  }
  return out;
}

/** Direction in degrees. 370 is not an error, it is 10 — angles wrap. */
function winkel(
  raw: Record<string, unknown>,
  key: string,
  path: string,
  fallback: number,
  notices: TerraWorldDraftNotice[],
): number {
  const value = raw[key];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    add(notices, `${path}.${key}`, "invalid_type", `${key} is not a finite number — default ${fallback} used.`);
    return fallback;
  }
  return ((value % 360) + 360) % 360;
}

function auswahl<T extends string>(
  raw: Record<string, unknown>,
  key: string,
  path: string,
  erlaubt: readonly T[],
  fallback: T,
  code: "defaulted" | "rejected",
  notices: TerraWorldDraftNotice[],
): T {
  const value = raw[key];
  if (value === undefined || value === null) return fallback;
  if (typeof value === "string" && (erlaubt as readonly string[]).includes(value)) {
    return value as T;
  }
  add(
    notices,
    `${path}.${key}`,
    code,
    code === "rejected"
      ? `${key} "${String(value)}" is not one of ${erlaubt.join(", ")} — value rejected, "${fallback}" applies.`
      : `${key} "${String(value)}" is unknown — default "${fallback}" used.`,
  );
  return fallback;
}

function wahrheit(
  raw: Record<string, unknown>,
  key: string,
  path: string,
  fallback: boolean,
  notices: TerraWorldDraftNotice[],
): boolean {
  const value = raw[key];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "boolean") {
    add(notices, `${path}.${key}`, "invalid_type", `${key} is not a boolean — default ${fallback} used.`);
    return fallback;
  }
  return value;
}

/**
 * One free name. Checked exactly like any other model output: length, allowed
 * characters, no control characters. Returns null when the name is not
 * usable — Terra's own generator then names the element, which is a good
 * outcome, not a failure.
 */
export function pruefeName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > NAME_MAX) return null;
  if (!NAME_MUSTER.test(trimmed)) return null;
  return trimmed;
}

function namensListe(
  raw: unknown,
  path: string,
  notices: TerraWorldDraftNotice[],
): string[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    add(notices, path, "invalid_type", `${path} is not an array — ignored.`);
    return [];
  }
  const out: string[] = [];
  const gesehen = new Set<string>();
  raw.forEach((entry, index) => {
    if (out.length >= NAME_LISTE_MAX) return;
    const name = pruefeName(entry);
    if (!name) {
      add(notices, `${path}[${index}]`, "dropped", "Name is empty, too long or contains forbidden characters — dropped.");
      return;
    }
    const schluessel = name.toLocaleLowerCase("de-DE");
    if (gesehen.has(schluessel)) {
      add(notices, `${path}[${index}]`, "dropped", `Duplicate name "${name}" — dropped.`);
      return;
    }
    gesehen.add(schluessel);
    out.push(name);
  });
  if (Array.isArray(raw) && raw.length > NAME_LISTE_MAX) {
    add(notices, path, "clamped", `More than ${NAME_LISTE_MAX} names — the rest was cut.`);
  }
  return out;
}

/* --------------------------------------------------------------------------
   The validator
   -------------------------------------------------------------------------- */

export function validateTerraWorldDraft(raw: unknown): TerraWorldDraftResult {
  const errors: TerraWorldDraftNotice[] = [];
  scanExecutable(raw, "$", errors);
  if (!isRecord(raw)) {
    add(errors, "$", "invalid_type", "Draft must be a JSON object.");
    return { ok: false, errors };
  }
  if (raw.kind !== undefined && raw.kind !== TERRA_WORLD_DRAFT_KIND) {
    add(errors, "$.kind", "rejected", `kind must be ${TERRA_WORLD_DRAFT_KIND}.`);
  }
  if (raw.schemaVersion !== undefined && raw.schemaVersion !== TERRA_WORLD_DRAFT_SCHEMA_VERSION) {
    add(errors, "$.schemaVersion", "rejected", "schemaVersion must be 1.");
  }
  /* The four fatal cases, and only those. Everything from here on clamps:
     a model that talks nonsense must produce a boring map, not a broken one. */
  if (errors.length > 0) return { ok: false, errors };

  const notices: TerraWorldDraftNotice[] = [];
  noteUnknown(raw, TOP_LEVEL_KEYS, "$", notices);
  const std = TERRA_WORLD_DRAFT_STANDARD;

  /* Map size is an enum, not a range: 700 is not "roughly 512". A wrong value
     falls back to the default instead of being rounded to a neighbour — a
     silently resized map would carry a height delta that no longer fits
     (see the kartenGroesse note in editor/io.js). */
  let kartenGroesse: TerraKartenGroesse = std.kartenGroesse;
  if (raw.kartenGroesse !== undefined && raw.kartenGroesse !== null) {
    const gewuenscht = typeof raw.kartenGroesse === "number" ? Math.round(raw.kartenGroesse) : NaN;
    if ((TERRA_KARTEN_GROESSEN as readonly number[]).includes(gewuenscht)) {
      kartenGroesse = gewuenscht as TerraKartenGroesse;
    } else {
      add(
        notices,
        "$.kartenGroesse",
        "defaulted",
        `kartenGroesse "${String(raw.kartenGroesse)}" is not one of ${TERRA_KARTEN_GROESSEN.join(", ")} — default ${std.kartenGroesse} used.`,
      );
    }
  }

  /* stil null means "derive from the biome" — that is a better answer to an
     invented style than picking one. */
  let stil: TerraBaustil | null = null;
  if (raw.stil !== undefined && raw.stil !== null) {
    if (typeof raw.stil === "string" && (TERRA_BAUSTILE as readonly string[]).includes(raw.stil)) {
      stil = raw.stil as TerraBaustil;
    } else {
      add(
        notices,
        "$.stil",
        "rejected",
        `stil "${String(raw.stil)}" is not one of ${TERRA_BAUSTILE.join(", ")} — value rejected, the biome decides.`,
      );
    }
  }

  const klimaRoh = isRecord(raw.klima) ? raw.klima : {};
  if (raw.klima !== undefined && !isRecord(raw.klima)) {
    add(notices, "$.klima", "invalid_type", "klima is not an object — defaults used.");
  } else {
    noteUnknown(klimaRoh, KLIMA_KEYS, "$.klima", notices);
  }

  const reliefRoh = isRecord(raw.relief) ? raw.relief : {};
  if (raw.relief !== undefined && !isRecord(raw.relief)) {
    add(notices, "$.relief", "invalid_type", "relief is not an object — defaults used.");
  } else {
    noteUnknown(reliefRoh, RELIEF_KEYS, "$.relief", notices);
  }

  const namenRoh = isRecord(raw.namen) ? raw.namen : {};
  if (raw.namen !== undefined && !isRecord(raw.namen)) {
    add(notices, "$.namen", "invalid_type", "namen is not an object — ignored.");
  } else {
    noteUnknown(namenRoh, NAMEN_KEYS, "$.namen", notices);
  }

  const region = namenRoh.region === undefined || namenRoh.region === null
    ? null
    : pruefeName(namenRoh.region);
  if (namenRoh.region !== undefined && namenRoh.region !== null && !region) {
    add(notices, "$.namen.region", "dropped", "Region name is empty, too long or contains forbidden characters — dropped.");
  }

  let notizen: string | undefined;
  if (typeof raw.notizen === "string") {
    const gekuerzt = raw.notizen.trim().replace(/\s+/g, " ").slice(0, NOTIZ_MAX);
    if (gekuerzt) notizen = gekuerzt;
    if (raw.notizen.trim().length > NOTIZ_MAX) {
      add(notices, "$.notizen", "clamped", `notizen longer than ${NOTIZ_MAX} characters — cut.`);
    }
  } else if (raw.notizen !== undefined && raw.notizen !== null) {
    add(notices, "$.notizen", "invalid_type", "notizen is not a string — ignored.");
  }

  const draft: TerraWorldDraft = {
    schemaVersion: TERRA_WORLD_DRAFT_SCHEMA_VERSION,
    kind: TERRA_WORLD_DRAFT_KIND,
    biom: auswahl(raw, "biom", "$", TERRA_BIOME, std.biom, "defaulted", notices),
    kartenGroesse,
    /* 0.01 m/cell is a tabletop battle map, 5000 is a continent. Outside that
       the scale bar in ui/beschriftung.js reads as nonsense. */
    einheitMeter: zahl(raw, "einheitMeter", "$", std.einheitMeter, 0.01, 5000, notices),
    klima: {
      richtung: winkel(klimaRoh, "richtung", "$.klima", std.klima.richtung, notices),
      staerke: zahl(klimaRoh, "staerke", "$.klima", std.klima.staerke, 0, 1, notices),
      grund: zahl(klimaRoh, "grund", "$.klima", std.klima.grund, 0, 1, notices),
      hoeheKuehl: zahl(klimaRoh, "hoeheKuehl", "$.klima", std.klima.hoeheKuehl, 0, 0.1, notices),
    },
    relief: {
      richtung: winkel(reliefRoh, "richtung", "$.relief", std.relief.richtung, notices),
      staerke: zahl(reliefRoh, "staerke", "$.relief", std.relief.staerke, 0, 1, notices),
    },
    fluesse: zahl(raw, "fluesse", "$", std.fluesse, 0, TERRA_MAX.fluesse, notices, { integer: true }),
    siedlungen: zahl(raw, "siedlungen", "$", std.siedlungen, 0, TERRA_MAX.siedlungen, notices, { integer: true }),
    waelder: zahl(raw, "waelder", "$", std.waelder, 0, TERRA_MAX.waelder, notices, { integer: true }),
    wiesen: zahl(raw, "wiesen", "$", std.wiesen, 0, TERRA_MAX.wiesen, notices, { integer: true }),
    ranken: zahl(raw, "ranken", "$", std.ranken, 0, TERRA_MAX.ranken, notices, { integer: true }),
    strassen: wahrheit(raw, "strassen", "$", std.strassen, notices),
    stil,
    /* An invented language family is REJECTED, not silently mapped to
       something similar: the six families carry whole word lists, and
       pretending "nordisch" is one of them would produce names that promise a
       language Terra cannot speak. "auto" lets the biome decide, which is
       honest. */
    sprachfamilie: auswahl(raw, "sprachfamilie", "$", TERRA_SPRACHFAMILIEN, std.sprachfamilie, "rejected", notices),
    tageszeit: auswahl(raw, "tageszeit", "$", TERRA_TAGESZEITEN, std.tageszeit, "defaulted", notices),
    wetter: auswahl(raw, "wetter", "$", TERRA_WETTER, std.wetter, "defaulted", notices),
    namen: {
      region,
      orte: namensListe(namenRoh.orte, "$.namen.orte", notices),
      fluesse: namensListe(namenRoh.fluesse, "$.namen.fluesse", notices),
      waelder: namensListe(namenRoh.waelder, "$.namen.waelder", notices),
      ranken: namensListe(namenRoh.ranken, "$.namen.ranken", notices),
    },
    ...(notizen ? { notizen } : {}),
  };

  return { ok: true, draft, notices };
}

export function isTerraWorldDraft(raw: unknown): raw is TerraWorldDraft {
  return validateTerraWorldDraft(raw).ok;
}

export function buildTerraWorldDraftPromptContext(): TerraWorldDraftPromptContext {
  return {
    schemaVersion: TERRA_WORLD_DRAFT_SCHEMA_VERSION,
    kind: TERRA_WORLD_DRAFT_KIND,
    biome: TERRA_BIOME,
    kartenGroessen: TERRA_KARTEN_GROESSEN,
    sprachfamilien: TERRA_SPRACHFAMILIEN,
    baustile: TERRA_BAUSTILE,
    tageszeiten: TERRA_TAGESZEITEN,
    wetter: TERRA_WETTER,
    rules: [
      "Return only JSON, no Markdown and no code.",
      `Use kind ${TERRA_WORLD_DRAFT_KIND} and schemaVersion ${TERRA_WORLD_DRAFT_SCHEMA_VERSION}.`,
      "Never return coordinates, point lists, polygons, height data or elements — Terra's generator owns all geometry.",
      "Counts are whole wishes; Terra decides where things end up.",
      "Names are optional; Terra names everything you leave out.",
    ],
  };
}

/**
 * The prompt half of the contract, derived from the same constants the
 * validator enforces — prompt and validator cannot drift.
 */
export function formatTerraWorldDraftPromptContext(
  context: TerraWorldDraftPromptContext = buildTerraWorldDraftPromptContext(),
): string {
  return [
    "Terra world draft context:",
    `- JSON shape: {"schemaVersion":${context.schemaVersion},"kind":"${context.kind}",` +
      `"biom":"kueste","kartenGroesse":512,"einheitMeter":250,` +
      `"klima":{"richtung":15,"staerke":0.6,"grund":0.5,"hoeheKuehl":0.012},` +
      `"relief":{"richtung":0,"staerke":0.8},` +
      `"fluesse":1,"siedlungen":3,"waelder":6,"wiesen":4,"ranken":2,` +
      `"strassen":true,"stil":"dorf","sprachfamilie":"dorf",` +
      `"tageszeit":"abend","wetter":"bewoelkt",` +
      `"namen":{"region":"Die Graue Küste","orte":["Möwenfurt","Salzhafen"],"fluesse":["Die Trübe"],"waelder":[],"ranken":[]},` +
      `"notizen":"Rau, spätherbstlich."}`,
    `- biom: ${context.biome.join(", ")}`,
    `- kartenGroesse: ${context.kartenGroessen.join(", ")}`,
    `- sprachfamilie: ${context.sprachfamilien.join(", ")} (nothing else exists — use "auto" if unsure)`,
    `- stil: ${context.baustile.join(", ")} or null`,
    `- tageszeit: ${context.tageszeiten.join(", ")}`,
    `- wetter: ${context.wetter.join(", ")}`,
    "- klima.richtung/relief.richtung in degrees, Terra's compass: 0 = north, 90 = east, 180 = south, 270 = west." +
      " klima.richtung is the direction it gets colder in; relief.richtung is where the mountains lie," +
      " relief.staerke 0..1 (0 = no wish).",
    `- Counts: fluesse 0..${TERRA_MAX.fluesse}, siedlungen 0..${TERRA_MAX.siedlungen},` +
      ` waelder 0..${TERRA_MAX.waelder}, wiesen 0..${TERRA_MAX.wiesen}, ranken 0..${TERRA_MAX.ranken}.`,
    "- einheitMeter: world metres per grid cell (1 = one metre, 250 = an overland map).",
    "- Names: plain text, at most 48 characters, letters/digits/space/hyphen/apostrophe only.",
    ...context.rules.map((rule) => `- ${rule}`),
  ].join("\n");
}
