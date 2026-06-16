import type { AccessContext } from "@uwe/auth";
import { buildWorldGraph } from "@uwe/database/server";
import type { AuthService, UweRepository } from "@uwe/database/server";
import { PRIVATE_LEAK_MARKERS, SECURITY_MARKERS } from "./markers";
import type { SecurityFixtureContent } from "./fixtures/security-fixture";

export interface LeakFinding {
  source: string;
  marker: string;
  excerpt?: string;
}

export interface LeakScanResult {
  findings: LeakFinding[];
  scannedSources: string[];
}

function collectStrings(value: unknown, bucket: string[] = []): string[] {
  if (value == null) {
    return bucket;
  }

  if (typeof value === "string") {
    bucket.push(value);
    return bucket;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, bucket);
    }
    return bucket;
  }

  if (typeof value === "object") {
    for (const entry of Object.values(value as Record<string, unknown>)) {
      collectStrings(entry, bucket);
    }
  }

  return bucket;
}

export function scanTextForPrivateMarkers(
  text: string,
  source: string,
): LeakFinding[] {
  const findings: LeakFinding[] = [];

  for (const marker of PRIVATE_LEAK_MARKERS) {
    if (text.includes(marker)) {
      const index = text.indexOf(marker);
      findings.push({
        source,
        marker,
        excerpt: text.slice(Math.max(0, index - 20), index + marker.length + 20),
      });
    }
  }

  return findings;
}

export function scanPayloadForPrivateMarkers(
  payload: unknown,
  source: string,
): LeakFinding[] {
  return scanTextForPrivateMarkers(collectStrings(payload).join("\n"), source);
}

/**
 * Simulates every anonymous / public portal data path and scans for private markers.
 * Mirrors what /worlds/* and related public APIs expose without a session.
 */
export async function scanPublicPortalForLeaks(
  repo: UweRepository,
  content: SecurityFixtureContent,
): Promise<LeakScanResult> {
  const findings: LeakFinding[] = [];
  const scannedSources: string[] = [];
  const { publicWorldSlug, privateWorldSlug, slugs } = content;

  const record = (source: string, payload: unknown) => {
    scannedSources.push(source);
    findings.push(...scanPayloadForPrivateMarkers(payload, source));
  };

  record("listWorlds", await repo.listWorlds());

  for (const worldSlug of [publicWorldSlug, privateWorldSlug]) {
    record(`listPagesForContext:portal:${worldSlug}`, await repo.listPagesForContext(worldSlug, "portal"));

    for (const pageSlug of Object.values(slugs)) {
      record(
        `getPublicPageForPortal:${worldSlug}/${pageSlug}`,
        await repo.getPublicPageForPortal(worldSlug, pageSlug),
      );
    }

    record(`listAssetsForContext:portal:${worldSlug}`, await repo.listAssetsForContext(worldSlug, "portal"));

    for (const assetKey of ["publicMedia", "privateMedia"] as const) {
      record(
        `getAssetForContext:portal:${content.assetIds[assetKey]}`,
        await repo.getAssetForContext(content.assetIds[assetKey], "portal"),
      );
    }

    record(
      `search:portal:${worldSlug}:DM_ONLY`,
      await repo.search("portal", { query: "DM_ONLY_SECRET", worldSlug, limit: 50 }),
    );
    record(
      `search:portal:${worldSlug}:DRAFT`,
      await repo.search("portal", { query: "PRIVATE_DRAFT", worldSlug, limit: 50 }),
    );
    record(
      `search:portal:${worldSlug}:HIDDEN`,
      await repo.search("portal", { query: "HIDDEN_SECRET", worldSlug, limit: 50 }),
    );
    record(
      `search:portal:${worldSlug}:PRIVATE_MEDIA`,
      await repo.search("portal", { query: "PRIVATE_MEDIA", worldSlug, limit: 50 }),
    );

    record(
      `buildWorldGraph:portal:${worldSlug}`,
      await buildWorldGraph(repo, worldSlug, "portal"),
    );
  }

  return { findings, scannedSources };
}

/**
 * Scans authenticated player views — dm_only markers must not appear even for players.
 */
export async function scanPlayerViewForDmLeaks(
  auth: AuthService,
  repo: UweRepository,
  ctx: AccessContext,
  content: SecurityFixtureContent,
): Promise<LeakScanResult> {
  const findings: LeakFinding[] = [];
  const scannedSources: string[] = [];
  const { publicWorldSlug, slugs } = content;

  const record = (source: string, payload: unknown) => {
    scannedSources.push(source);
    if (payload == null) {
      return;
    }
    const text = collectStrings(payload).join("\n");
    if (text.includes(SECURITY_MARKERS.DM_ONLY)) {
      findings.push({
        source,
        marker: SECURITY_MARKERS.DM_ONLY,
        excerpt: text.slice(0, 120),
      });
    }
  };

  record("listPagesForViewer", await auth.listPagesForViewer(publicWorldSlug, ctx));

  for (const pageSlug of Object.values(slugs)) {
    record(
      `getPageForViewer:${pageSlug}`,
      await auth.getPageForViewer(publicWorldSlug, pageSlug, ctx),
    );
  }

  record(
    "searchForViewer:DM_ONLY",
    await auth.searchForViewer(publicWorldSlug, ctx, {
      query: "DM_ONLY_SECRET",
      limit: 50,
    }),
  );

  record("listAssetsForContext:portal", await repo.listAssetsForContext(publicWorldSlug, "portal"));

  return { findings, scannedSources };
}

export function formatLeakReport(result: LeakScanResult): string {
  if (result.findings.length === 0) {
    return `No leaks (${result.scannedSources.length} sources scanned).`;
  }

  return result.findings
    .map(
      (finding) =>
        `[LEAK] ${finding.source} contains ${finding.marker}${finding.excerpt ? `: …${finding.excerpt}…` : ""}`,
    )
    .join("\n");
}
