/**
 * Generated history ("Chronik") — deterministic lore hooks for a map.
 * Hash-based (no Math.random/Date): same options → same chronicle.
 */

export interface ChronicleActor {
  name: string;
  kind: "siedlung" | "ort" | "region";
}

export interface ChronicleEntry {
  year: number;
  text: string;
}

export interface ChronicleOptions {
  seed: number;
  actors: readonly ChronicleActor[];
  /** Era name woven into some entries. Default "Drittes Zeitalter". */
  era?: string;
  /** Number of entries, default 8, max 14. */
  entryCount?: number;
}

function hash01(a: number, b: number, seed: number): number {
  let n = Math.imul(Math.round(a * 8191) + Math.round(b * 131071) + seed * 7919, 2654435761);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

const GENERIC_PLACES = [
  "die Küste",
  "das Hochland",
  "der alte Wald",
  "die Furt am Strom",
  "das Grenzland",
  "die Nebelhügel",
] as const;

/** One template = several one-sentence phrasings; {A}/{B}/{ERA} get replaced. */
const TEMPLATES: readonly (readonly string[])[] = [
  [
    "Gründung von {A}; die ersten Feuer brennen im {ERA}.",
    "Siedler errichten {A} und stecken die ersten Grenzsteine.",
    "{A} wird gegründet, kaum mehr als ein Lager im Wind.",
  ],
  [
    "Krieg zwischen {A} und {B} — nach drei bitteren Wintern siegt {A}.",
    "Eine Fehde entzweit {A} und {B}, bis ein Schwur den Frieden erzwingt.",
    "{A} und {B} ziehen gegeneinander zu Felde; {B} behält das Feld.",
    "Der Zwist zwischen {A} und {B} endet unentschieden, doch das Misstrauen bleibt.",
  ],
  [
    "Eine große Dürre sucht {A} heim und treibt viele fort.",
    "Eine Flut begräbt die Felder bei {A} unter Schlamm.",
    "Ein Beben erschüttert {A}; alte Mauern stürzen ein.",
  ],
  [
    "Ein Omen steht über {A}: zwei Monde in einer Nacht, so berichten die Annalen des {ERA}.",
    "Bei {A} geschieht ein Wunder, von dem noch lange erzählt wird.",
    "Seher deuten ein Zeichen am Himmel über {A} — Glück, sagen die einen, Unheil die anderen.",
  ],
  [
    "{A} und {B} schließen einen Handelsbund, und die Straßen füllen sich mit Karren.",
    "Ein Handelsbund verbindet {A} mit {B}; Zölle fallen, Märkte wachsen.",
    "Kaufleute aus {A} und {B} besiegeln einen Bund mit Salz und Silber.",
  ],
  [
    "{A} verfällt; nur wenige halten den Ort noch.",
    "Der Niedergang von {A} beginnt schleichend, mit leeren Speichern.",
    "{A} verliert Rang und Reichtum, und die Jungen ziehen fort.",
  ],
  [
    "{A} wird Stein um Stein wieder aufgebaut.",
    "Nach den mageren Jahren beginnt in {A} der Wiederaufbau.",
    "Handwerker strömen nach {A}, und neue Dächer decken alte Wunden.",
  ],
  [
    "Bei {A} wird ein Pass durch die Berge entdeckt.",
    "Kundschafter finden eine weitläufige Höhle bei {A}.",
    "Ein vergessener Pfad bei {A} wird wiederentdeckt und kartiert.",
  ],
];

interface NamedActor {
  name: string;
}

function actorPool(actors: readonly ChronicleActor[]): readonly NamedActor[] {
  if (actors.length > 0) return actors;
  return GENERIC_PLACES.map((name) => ({ name }));
}

/**
 * Deterministic chronicle: strictly ascending years, German one-sentence
 * entries from event templates; actors are picked by hash (A ≠ B) and no
 * template repeats twice in a row.
 */
export function generateChronicle(options: ChronicleOptions): ChronicleEntry[] {
  const era = options.era ?? "Drittes Zeitalter";
  const entryCount = Math.max(1, Math.min(14, Math.floor(options.entryCount ?? 8)));
  const pool = actorPool(options.actors);
  const seed = options.seed;

  let year = 12 + Math.floor(hash01(0, 1, seed) * 369); // 12..380
  const actorOffset = Math.floor(hash01(0, 2, seed) * pool.length);
  const entries: ChronicleEntry[] = [];
  let previousTemplate = -1;

  for (let i = 0; i < entryCount; i++) {
    let templateIndex = Math.floor(hash01(i, 3, seed) * TEMPLATES.length) % TEMPLATES.length;
    if (templateIndex === previousTemplate) templateIndex = (templateIndex + 1) % TEMPLATES.length;
    previousTemplate = templateIndex;

    const variants = TEMPLATES[templateIndex];
    const variant = variants[Math.floor(hash01(i, 4, seed) * variants.length) % variants.length];

    // Cycle through the pool so every actor appears when entryCount >= pool size.
    const aIndex = (i + actorOffset) % pool.length;
    let bIndex = pool.length > 1 ? Math.floor(hash01(i, 5, seed) * (pool.length - 1)) : 0;
    if (pool.length > 1 && bIndex >= aIndex) bIndex += 1;
    const a = pool[aIndex].name;
    const b = pool[bIndex % pool.length].name;

    const text = variant.replaceAll("{A}", a).replaceAll("{B}", b).replaceAll("{ERA}", era);
    entries.push({ year, text });
    year += 5 + Math.floor(hash01(i, 6, seed) * 56); // step 5..60
  }
  return entries;
}
