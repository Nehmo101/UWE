const DM_ONLY_MARKERS = [
  "gm-only",
  "dm-only",
  "spielleiter",
  "geheimnis",
  "versteckt",
  "hintergrund:",
  "meta:",
  "plot twist",
  "twist:",
] as const;

export interface PlayerSafeCheckResult {
  safe: boolean;
  issues: string[];
  dmOnlyPhrases: string[];
}

function findDmOnlyPhrasesInText(text: string): string[] {
  const found: string[] = [];
  const lower = text.toLowerCase();
  for (const marker of DM_ONLY_MARKERS) {
    if (lower.includes(marker)) {
      found.push(marker);
    }
  }
  return found;
}

/** Checks generated player-facing text for DM-only leaks. */
export function checkPlayerSafeOutput(text: string): PlayerSafeCheckResult {
  const issues: string[] = [];
  const dmOnlyPhrases = findDmOnlyPhrasesInText(text);

  if (dmOnlyPhrases.length > 0) {
    issues.push(`DM-only-Marker erkannt: ${dmOnlyPhrases.join(", ")}`);
  }

  if (/\[dm-only\]|\[gm-only\]/i.test(text)) {
    issues.push("Explizite DM-only-Tags im Spielertext.");
  }

  return {
    safe: issues.length === 0,
    issues,
    dmOnlyPhrases,
  };
}

export function stripDmOnlySections(text: string): string {
  const lines = text.split("\n");
  const filtered = lines.filter((line) => {
    const lower = line.toLowerCase().trim();
    if (lower.startsWith("dm:") || lower.startsWith("gm:")) return false;
    if (lower.includes("[dm-only]") || lower.includes("[gm-only]")) return false;
    return true;
  });
  return filtered.join("\n").trim();
}
