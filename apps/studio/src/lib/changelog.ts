import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(MODULE_DIR, "..", "..", "..", "..");

export interface ChangelogSection {
  /** Keep-a-Changelog heading, e.g. Added, Changed, Security. */
  kind: string;
  items: string[];
}

export interface ChangelogRelease {
  version: string;
  /** ISO date from the release heading, when present. */
  date: string | null;
  unreleased: boolean;
  sections: ChangelogSection[];
  /** Optional compare/release URL from footer link refs. */
  url: string | null;
}

const RELEASE_HEADING = /^## \[([^\]]+)\](?:\s*-\s*(.+))?$/;
const SECTION_HEADING = /^### (.+)$/;
const BULLET = /^- (.+)$/;
const LINK_REF = /^\[([^\]]+)\]:\s+(\S+)\s*$/;

function parseReleaseDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) return trimmed;
  return new Date(parsed).toISOString().slice(0, 10);
}

/**
 * Parse a Keep a Changelog markdown document into structured releases.
 * Pure function — safe for unit tests without filesystem access.
 */
export function parseChangelog(content: string): ChangelogRelease[] {
  const linkRefs = new Map<string, string>();
  const releases: ChangelogRelease[] = [];

  let currentRelease: ChangelogRelease | null = null;
  let currentSection: ChangelogSection | null = null;

  // Split on CRLF as well as LF: with git's autocrlf the CHANGELOG is checked
  // out with CRLF on Windows, and a trailing "\r" would silently defeat the
  // `$`-anchored heading regexes. Parsing must not depend on the checkout OS.
  for (const line of content.split(/\r\n|\n/)) {
    const linkMatch = line.match(LINK_REF);
    if (linkMatch) {
      linkRefs.set(linkMatch[1]!, linkMatch[2]!);
      continue;
    }

    const releaseMatch = line.match(RELEASE_HEADING);
    if (releaseMatch) {
      const version = releaseMatch[1]!.trim();
      currentRelease = {
        version,
        date: parseReleaseDate(releaseMatch[2]),
        unreleased: version.toLowerCase() === "unreleased",
        sections: [],
        url: null,
      };
      releases.push(currentRelease);
      currentSection = null;
      continue;
    }

    const sectionMatch = line.match(SECTION_HEADING);
    if (sectionMatch && currentRelease) {
      currentSection = { kind: sectionMatch[1]!.trim(), items: [] };
      currentRelease.sections.push(currentSection);
      continue;
    }

    const bulletMatch = line.match(BULLET);
    if (bulletMatch && currentSection) {
      currentSection.items.push(bulletMatch[1]!.trim());
    }
  }

  for (const release of releases) {
    release.url = linkRefs.get(release.version) ?? null;
  }

  return releases;
}

/**
 * Load parsed release notes from the repo CHANGELOG.md.
 * Returns an empty list when the file is unavailable (e.g. standalone bundle).
 */
export function getChangelogReleases(): ChangelogRelease[] {
  const changelogPath = join(REPO_ROOT, "CHANGELOG.md");
  if (!existsSync(changelogPath)) return [];

  try {
    const content = readFileSync(changelogPath, "utf8");
    return parseChangelog(content);
  } catch {
    return [];
  }
}

/** Find the release entry matching an app version string (without leading "v"). */
export function findReleaseForVersion(
  releases: ChangelogRelease[],
  version: string,
): ChangelogRelease | null {
  const normalized = version.replace(/^v/i, "").trim();
  return (
    releases.find(
      (release) =>
        !release.unreleased &&
        release.version.replace(/^v/i, "").trim() === normalized,
    ) ?? null
  );
}
