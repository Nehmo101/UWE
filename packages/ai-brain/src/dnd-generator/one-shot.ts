/**
 * One-Shot-Generator aus dem eigenen Kanon: erzeugt aus einem Ort, einem Ton und
 * bekannten NPCs ein deterministisches One-Shot-Gerüst. Kanon-safe und mit klarer
 * Trennung von Spielerwissen (playerBrief) und DM-Geheimnissen — ein Entwurf zum
 * Review, nie automatisch Kanon. Pure Funktionen, testbar ohne KI. Eine spätere
 * Maschinenraum-lokale LLM-Ausschmückung kann darauf aufsetzen.
 */

export type OneShotTone = "duester" | "lustig" | "horror" | "mystery";

export const ONE_SHOT_TONES: OneShotTone[] = ["duester", "lustig", "horror", "mystery"];

export const ONE_SHOT_TONE_LABELS: Record<OneShotTone, string> = {
  duester: "Düster",
  lustig: "Lustig",
  horror: "Horror",
  mystery: "Mystery",
};

interface ToneProfile {
  atmosphere: string;
  hook: (location: string) => string;
  encounter: string;
  twist: string;
}

const TONE_PROFILES: Record<OneShotTone, ToneProfile> = {
  duester: {
    atmosphere: "Grau, regnerisch, moralisch ambivalent.",
    hook: (loc) => `In ${loc} verschwindet nachts, wer zu viele Fragen stellt.`,
    encounter: "Verzweifelte Söldner, die zuerst schießen.",
    twist: "Der Auftraggeber ist selbst die Ursache des Übels.",
  },
  lustig: {
    atmosphere: "Überdreht, chaotisch, mit gutmütigem Slapstick.",
    hook: (loc) => `In ${loc} ist das jährliche Fest ausgebrochen — und außer Kontrolle geraten.`,
    encounter: "Ein entlaufenes magisches Haustier stiftet Unordnung.",
    twist: "Das eigentliche Chaos ist ein missverstandener Zauber, kein Bösewicht.",
  },
  horror: {
    atmosphere: "Beklemmend, still, mit wachsendem Grauen.",
    hook: (loc) => `${loc} ist zu ruhig — die Bewohner lächeln alle gleich.`,
    encounter: "Etwas trägt die Gesichter der Vermissten.",
    twist: "Die Rettung, die die Gruppe sucht, ist längst Teil des Grauens.",
  },
  mystery: {
    atmosphere: "Rätselhaft, mit Hinweisen und roten Heringen.",
    hook: (loc) => `In ${loc} passt eine offizielle Version der Ereignisse vorne und hinten nicht.`,
    encounter: "Ein Zeuge, der mehr weiß, aber Angst hat zu reden.",
    twist: "Der offensichtlichste Verdächtige deckt jemand Mächtigeren.",
  },
};

export interface OneShotNpc {
  name: string;
  role?: string;
}

export interface OneShotInput {
  worldName: string;
  worldSlug: string;
  locationName: string;
  tone: OneShotTone;
  npcs: OneShotNpc[];
}

export interface OneShotOutline {
  title: string;
  tone: OneShotTone;
  atmosphere: string;
  hook: string;
  /** Spielersichere Kurzbeschreibung — enthält keine Geheimnisse/Twists. */
  playerBrief: string;
  scenes: string[];
  encounter: string;
  loot: string;
  involvedNpcs: string[];
  /** Nur-DM: Twist und verborgene Gefahren. */
  dmSecrets: string[];
  canonWarnings: string[];
}

export function buildOneShotOutline(input: OneShotInput): OneShotOutline {
  const profile = TONE_PROFILES[input.tone] ?? TONE_PROFILES.mystery;
  const location = input.locationName.trim() || "einem unbenannten Ort";
  const npcs = input.npcs.filter((npc) => npc.name.trim());
  const npcNames = npcs.map((npc) => (npc.role ? `${npc.name} (${npc.role})` : npc.name));
  const anchorNpc = npcs[0]?.name;

  const hook = profile.hook(location);

  return {
    title: `One-Shot: ${location} — ${ONE_SHOT_TONE_LABELS[input.tone]}`,
    tone: input.tone,
    atmosphere: profile.atmosphere,
    hook,
    playerBrief: `${hook} Die Gruppe wird nach ${location} gerufen. ${
      anchorNpc ? `${anchorNpc} bittet um Hilfe.` : "Ein lokaler Kontakt bittet um Hilfe."
    }`,
    scenes: [
      `Ankunft in ${location}: Atmosphäre etablieren (${profile.atmosphere})`,
      anchorNpc
        ? `Kontakt mit ${anchorNpc}: erste Hinweise und Motivation`
        : "Kontakt mit einem lokalen Hinweisgeber",
      `Zuspitzung: ${profile.encounter}`,
      "Finale: Konfrontation und Auflösung",
    ],
    encounter: profile.encounter,
    loot:
      input.tone === "horror"
        ? "Sparsam — ein verstörendes Artefakt statt Gold."
        : "Ortstypische Belohnung + ein kleiner magischer Gegenstand.",
    involvedNpcs: npcNames,
    dmSecrets: [
      `Twist: ${profile.twist}`,
      "Verborgene Gefahr, die erst spät sichtbar wird.",
      ...(npcs.length > 1 ? [`${npcs[1].name} verfolgt eigene Ziele.`] : []),
    ],
    canonWarnings:
      input.worldSlug === "terra"
        ? [
            "Terra-Kanon: bestehende NPC-Zustände und Orts-Fakten nicht überschreiben.",
            "Spielerwissen beachten — nichts vorwegnehmen, was die Gruppe noch nicht weiß.",
          ]
        : ["Vor Übernahme gegen bestehenden Kanon prüfen (NPCs, Orte, Zeitlinie)."],
  };
}

export function serializeOneShotOutline(outline: OneShotOutline): string {
  const sections: string[] = [
    `# ${outline.title}`,
    `*Ton: ${ONE_SHOT_TONE_LABELS[outline.tone]} — ${outline.atmosphere}*`,
    "",
    "## Spieler-Brief",
    outline.playerBrief,
    "",
    "## Szenen",
    ...outline.scenes.map((scene, index) => `${index + 1}. ${scene}`),
    "",
    "## Encounter",
    `- ${outline.encounter}`,
    "",
    "## Belohnung",
    `- ${outline.loot}`,
    "",
    "## Beteiligte NPCs",
    ...(outline.involvedNpcs.length > 0 ? outline.involvedNpcs.map((n) => `- ${n}`) : ["- (keine ausgewählt)"]),
    "",
    "## DM-Geheimnisse (nicht an Spieler)",
    ...outline.dmSecrets.map((s) => `- ${s}`),
    "",
    "## Kanon-Warnungen",
    ...outline.canonWarnings.map((w) => `- ${w}`),
  ];
  return sections.join("\n");
}
