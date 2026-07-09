import { REQUIRED_PALETTE_KEYS } from "@uwe/theme-studio";
import type { ThemeChatMessage } from "./types";

const SCOPE_HINT: Record<string, string> = {
  studio: "das DM-Studio (Cockpit, dichte Arbeitsoberfläche)",
  portal: "das Spieler-Portal (ruhiges Lese-Wiki)",
  both: "Studio und Portal gemeinsam",
};

/**
 * System prompt for the conversational design creator. The model either asks a
 * short follow-up question OR proposes palettes, always as a single strict JSON
 * object — never prose outside the JSON.
 */
export function buildThemeSystemPrompt(
  scope: "studio" | "portal" | "both",
  variantCount: number,
): string {
  const keys = REQUIRED_PALETTE_KEYS.join(", ");
  return [
    "Du bist der UWE Design-Assistent. Du hilfst per Fragebogen, ein neues UI-Farbdesign (Theme) zu entwerfen.",
    `Zielumgebung: ${SCOPE_HINT[scope] ?? SCOPE_HINT.both}. Sprache: Deutsch, informelles „du“. Keine Emojis.`,
    "",
    "Ablauf: Stelle bei fehlenden Infos höchstens EINE kurze, konkrete Rückfrage (hell/dunkel, Grundstimmung, Akzentfarbe, Serifen, Kontrast). Sobald genug Infos da sind, liefere Paletten-Kandidaten.",
    "",
    "Antworte AUSSCHLIESSLICH mit einem einzigen JSON-Objekt, ohne Text davor oder danach:",
    "{",
    '  "message": "kurze Antwort oder Rückfrage an den Nutzer",',
    `  "palettes": [ /* 0 Elemente wenn du eine Rückfrage stellst, sonst bis zu ${variantCount} */`,
    '    { "label": "Kurzname", "description": "1 Satz", "colors": { /* alle Pflicht-Tokens */ } }',
    "  ]",
    "}",
    "",
    `Jede Palette MUSS ALLE diese Farb-Tokens als Hex-Werte (#rrggbb) enthalten: ${keys}.`,
    "Regeln: Text (fg) auf Hintergrund (bg) und Links (link, wikiLink) auf bg müssen gut lesbar sein (WCAG AA ≥ 4.5:1).",
    "accent ist die Hauptakzentfarbe (Buttons, aktive Navigation). dmOnly markiert Nur-GM-Inhalte, playerVisible markiert spielersichtbare Inhalte.",
    "Gib niemals Erklärtext außerhalb des JSON aus.",
  ].join("\n");
}

/** Flatten the prior conversation + latest message + optional repair hint into one user prompt. */
export function buildThemeUserPrompt(
  history: ThemeChatMessage[],
  userMessage: string,
  repairHint?: string,
): string {
  const parts: string[] = [];
  if (history.length > 0) {
    parts.push("Bisheriger Gesprächsverlauf:");
    for (const message of history) {
      const who = message.role === "user" ? "Nutzer" : "Assistent";
      parts.push(`${who}: ${message.content}`);
    }
    parts.push("");
  }
  parts.push(`Neue Nachricht des Nutzers: ${userMessage}`);
  if (repairHint && repairHint.trim()) {
    parts.push("");
    parts.push(repairHint.trim());
  }
  return parts.join("\n");
}
