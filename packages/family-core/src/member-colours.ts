/**
 * Farben für Haushalts-Mitglieder.
 *
 * Jede Person bekommt eine Farbe, damit der Monatskalender auf einen Blick
 * zeigt, wen ein Termin betrifft. Die Palette ist bewusst klein und auf
 * Unterscheidbarkeit ausgelegt — auch nebeneinander als kleine Punkte.
 *
 * Rein und ohne Datenbank, damit testbar.
 */

/**
 * Acht Farben, die sich als 8-px-Punkt noch klar unterscheiden. Reihenfolge ist
 * die Vergabereihenfolge: die ersten Mitglieder bekommen die kontrastreichsten.
 */
export const FAMILY_MEMBER_COLOURS: readonly string[] = [
  "#e11d48", // Rot
  "#2563eb", // Blau
  "#16a34a", // Grün
  "#d97706", // Bernstein
  "#7c3aed", // Violett
  "#0891b2", // Türkis
  "#db2777", // Pink
  "#4d7c0f", // Oliv
];

/** Fallback, wenn keine Farbe gesetzt und keine freie Palettenfarbe übrig ist. */
export const FAMILY_MEMBER_FALLBACK_COLOUR = "#64748b";

const HEX_PATTERN = /^#[0-9a-f]{6}$/i;

/**
 * Normalisiert eine Farbeingabe auf `#rrggbb` in Kleinschreibung.
 * Gibt `null` zurück, wenn der Wert keine gültige Hex-Farbe ist — Aufrufer
 * entscheiden dann selbst, ob sie eine Palettenfarbe vergeben oder ablehnen.
 */
export function normaliseMemberColour(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  // Kurzform #abc auf #aabbcc aufziehen.
  const expanded =
    /^#[0-9a-f]{3}$/i.test(withHash)
      ? `#${withHash
          .slice(1)
          .split("")
          .map((c) => c + c)
          .join("")}`
      : withHash;
  return HEX_PATTERN.test(expanded) ? expanded.toLowerCase() : null;
}

/**
 * Wählt die nächste freie Palettenfarbe. `taken` sind die bereits vergebenen
 * Farben; die Suche ist stabil, damit dieselbe Ausgangslage dieselbe Farbe ergibt.
 */
export function nextFreeMemberColour(taken: Iterable<string>): string {
  const used = new Set<string>();
  for (const value of taken) {
    const normalised = normaliseMemberColour(value);
    if (normalised) used.add(normalised);
  }
  for (const colour of FAMILY_MEMBER_COLOURS) {
    if (!used.has(colour)) return colour;
  }
  return FAMILY_MEMBER_FALLBACK_COLOUR;
}

/**
 * Deterministische Farbe aus einer Kennung — für Mitglieder, die (noch) keine
 * eigene Farbe gespeichert haben. Gleiche Kennung ergibt immer dieselbe Farbe,
 * auch über Neustarts hinweg.
 */
export function colourForMemberId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  const index = hash % FAMILY_MEMBER_COLOURS.length;
  return FAMILY_MEMBER_COLOURS[index] ?? FAMILY_MEMBER_FALLBACK_COLOUR;
}

/**
 * Die effektiv anzuzeigende Farbe: gespeicherte Farbe, sonst deterministisch
 * aus der Kennung. Damit ist nie eine Person ohne Farbe im Kalender.
 */
export function resolveMemberColour(member: { id: string; colour: string }): string {
  return normaliseMemberColour(member.colour) ?? colourForMemberId(member.id);
}

/**
 * Relative Leuchtkraft nach WCAG. Wird gebraucht, um zu entscheiden, ob
 * Beschriftung auf der Farbe schwarz oder weiß sein muss.
 */
function relativeLuminance(hex: string): number {
  const value = normaliseMemberColour(hex) ?? FAMILY_MEMBER_FALLBACK_COLOUR;
  const channel = (start: number): number => {
    const raw = Number.parseInt(value.slice(start, start + 2), 16) / 255;
    return raw <= 0.03928 ? raw / 12.92 : ((raw + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** Lesbare Vordergrundfarbe auf der Mitgliedsfarbe. */
export function readableTextColour(background: string): "#ffffff" | "#111827" {
  return relativeLuminance(background) > 0.45 ? "#111827" : "#ffffff";
}
