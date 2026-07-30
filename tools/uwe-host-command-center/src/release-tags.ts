/**
 * Der Release-Tag ist der Vertrag zwischen einem UWE-Release und dem Command
 * Center: `uwe-vX.Y.Z` benennt die Version, das Release am Tag trägt die
 * Installer, die App-Bundles und `uwe-release.json`.
 *
 * Diese Datei hält die Tag-Grammatik und den Versionsvergleich — rein, ohne
 * git, Netz oder Dateisystem, damit beide Update-Wege (Checkout über git-Tags,
 * Bundle-Installation über das Release-Manifest) dieselbe Regel benutzen.
 */

export const RELEASE_TAG_PREFIX = "uwe-v";
const RELEASE_TAG_PATTERN = /^uwe-v(\d+\.\d+\.\d+)$/;

/** Ein Semver-String ohne Präfix, so wie `VERSION` ihn enthält. */
export function isReleaseVersion(value: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(value.trim());
}

export function compareSemver(left: string, right: string): number {
  const leftParts = left.split(".").map((part) => Number.parseInt(part, 10));
  const rightParts = right.split(".").map((part) => Number.parseInt(part, 10));
  for (let index = 0; index < 3; index += 1) {
    const delta = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (delta !== 0) return delta < 0 ? -1 : 1;
  }
  return 0;
}

export function parseReleaseTag(tag: string): { tag: string; version: string } | null {
  const match = tag.trim().match(RELEASE_TAG_PATTERN);
  if (!match) return null;
  return { tag: match[0], version: match[1]! };
}

/** Der höchste `uwe-v*`-Tag einer Liste; alles andere wird ignoriert. */
export function selectLatestReleaseTag(tags: string[]): { tag: string; version: string } | null {
  let latest: { tag: string; version: string } | null = null;
  for (const tag of tags) {
    const parsed = parseReleaseTag(tag);
    if (!parsed) continue;
    if (!latest || compareSemver(parsed.version, latest.version) > 0) {
      latest = parsed;
    }
  }
  return latest;
}
