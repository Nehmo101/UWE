import type { PrismaClient } from "./client";
import { PORTAL_BLOCK_VISIBILITIES, PORTAL_PAGE_VISIBILITIES } from "./permissions";
import type { Visibility } from "./generated/prisma/client";

export type PublicLeakSeverity = "critical" | "warning" | "info";

export interface PublicLeakFinding {
  id: string;
  severity: PublicLeakSeverity;
  worldSlug: string;
  worldName: string;
  targetType: "page" | "content_block" | "asset" | "soundboard_button";
  targetId: string;
  targetLabel: string;
  message: string;
  href?: string;
}

export interface PublicLeakScanResult {
  scannedAt: string;
  findingCount: number;
  criticalCount: number;
  warningCount: number;
  findings: PublicLeakFinding[];
}

const GM_BLOCK_TYPES = new Set(["gm_note", "secret", "dm_only"]);

const SUSPICIOUS_PATTERNS = [
  /\bgeheim\b/i,
  /\bdm[- ]?only\b/i,
  /\bgeheimplan\b/i,
  /\bhidden\b/i,
  /\bsecret\b/i,
  /\bstreng geheim\b/i,
];

/**
 * Scans published portal-visible content for potential DM-only leaks.
 * Server-side only — never returns raw secret content, only metadata.
 */
export async function scanPublicContentLeaks(
  db: PrismaClient,
): Promise<PublicLeakScanResult> {
  const findings: PublicLeakFinding[] = [];
  const worlds = await db.world.findMany({ select: { id: true, slug: true, name: true } });

  for (const world of worlds) {
    await scanPages(db, world, findings);
    await scanAssets(db, world, findings);
    await scanSoundboard(db, world, findings);
  }

  const criticalCount = findings.filter((f) => f.severity === "critical").length;
  const warningCount = findings.filter((f) => f.severity === "warning").length;

  return {
    scannedAt: new Date().toISOString(),
    findingCount: findings.length,
    criticalCount,
    warningCount,
    findings,
  };
}

async function scanPages(
  db: PrismaClient,
  world: { id: string; slug: string; name: string },
  findings: PublicLeakFinding[],
): Promise<void> {
  const pages = await db.page.findMany({
    where: {
      worldId: world.id,
      visibility: { in: PORTAL_PAGE_VISIBILITIES as Visibility[] },
    },
    include: { contentBlocks: true },
  });

  for (const page of pages) {
    if (page.visibility === "dm_only") {
      findings.push({
        id: `page:dm-only-published:${page.id}`,
        severity: "critical",
        worldSlug: world.slug,
        worldName: world.name,
        targetType: "page",
        targetId: page.id,
        targetLabel: page.title,
        message: "Seite ist dm_only, aber published — darf nie im Portal erscheinen.",
        href: `/worlds/${world.slug}/${page.type}/${page.slug}`,
      });
    }

    for (const block of page.contentBlocks) {
      if (block.visibility === "dm_only" && isPortalBlockInPortalPage(page.visibility)) {
        findings.push({
          id: `block:dm-only-in-portal-page:${block.id}`,
          severity: "critical",
          worldSlug: world.slug,
          worldName: world.name,
          targetType: "content_block",
          targetId: block.id,
          targetLabel: page.title,
          message: "DM-only Block in portal-sichtbarer Seite — wird gefiltert, aber prüfen.",
          href: `/worlds/${world.slug}/${page.type}/${page.slug}/edit`,
        });
      }

      if (
        isPortalBlockInPortalPage(page.visibility) &&
        PORTAL_BLOCK_VISIBILITIES.includes(block.visibility) &&
        GM_BLOCK_TYPES.has(block.type)
      ) {
        findings.push({
          id: `block:gm-type-portal-visible:${block.id}`,
          severity: "warning",
          worldSlug: world.slug,
          worldName: world.name,
          targetType: "content_block",
          targetId: block.id,
          targetLabel: page.title,
          message: `Block-Typ „${block.type}" ist portal-sichtbar — prüfe Inhalt.`,
          href: `/worlds/${world.slug}/${page.type}/${page.slug}/edit`,
        });
      }

      if (
        isPortalBlockInPortalPage(page.visibility) &&
        PORTAL_BLOCK_VISIBILITIES.includes(block.visibility) &&
        containsSuspiciousPattern(block.content)
      ) {
        findings.push({
          id: `block:suspicious-text:${block.id}`,
          severity: "warning",
          worldSlug: world.slug,
          worldName: world.name,
          targetType: "content_block",
          targetId: block.id,
          targetLabel: page.title,
          message: "Portal-sichtbarer Block enthält verdächtige Begriffe (Geheim/DM-only).",
          href: `/worlds/${world.slug}/${page.type}/${page.slug}/edit`,
        });
      }
    }
  }
}

async function scanAssets(
  db: PrismaClient,
  world: { id: string; slug: string; name: string },
  findings: PublicLeakFinding[],
): Promise<void> {
  const assets = await db.asset.findMany({
    where: {
      worldId: world.id,
      visibility: { in: PORTAL_PAGE_VISIBILITIES as Visibility[] },
    },
  });

  for (const asset of assets) {
    if (asset.visibility === "dm_only") {
      findings.push({
        id: `asset:dm-only-portal:${asset.id}`,
        severity: "critical",
        worldSlug: world.slug,
        worldName: world.name,
        targetType: "asset",
        targetId: asset.id,
        targetLabel: asset.title,
        message: "Asset ist dm_only, aber als portal-sichtbar markiert — Dateninkonsistenz.",
        href: `/worlds/${world.slug}/assets`,
      });
    }

    if (containsSuspiciousPattern(asset.title) || containsSuspiciousPattern(asset.description)) {
      findings.push({
        id: `asset:suspicious-title:${asset.id}`,
        severity: "info",
        worldSlug: world.slug,
        worldName: world.name,
        targetType: "asset",
        targetId: asset.id,
        targetLabel: asset.title,
        message: "Portal-sichtbares Asset mit verdächtigem Titel/Beschreibung.",
        href: `/worlds/${world.slug}/assets`,
      });
    }
  }
}

async function scanSoundboard(
  db: PrismaClient,
  world: { id: string; slug: string; name: string },
  findings: PublicLeakFinding[],
): Promise<void> {
  const buttons = await db.soundboardButton.findMany({
    where: {
      worldId: world.id,
      visibility: { in: PORTAL_PAGE_VISIBILITIES as Visibility[] },
    },
  });

  for (const button of buttons) {
    if (button.visibility === "dm_only") {
      findings.push({
        id: `soundboard:dm-only-portal:${button.id}`,
        severity: "critical",
        worldSlug: world.slug,
        worldName: world.name,
        targetType: "soundboard_button",
        targetId: button.id,
        targetLabel: button.title,
        message: "Soundboard-Button ist dm_only, aber portal-sichtbar markiert.",
        href: `/worlds/${world.slug}/soundboard`,
      });
    }
  }
}

function isPortalBlockInPortalPage(pageVisibility: Visibility): boolean {
  return PORTAL_PAGE_VISIBILITIES.includes(pageVisibility);
}

function containsSuspiciousPattern(text: string | null | undefined): boolean {
  if (!text?.trim()) {
    return false;
  }
  return SUSPICIOUS_PATTERNS.some((pattern) => pattern.test(text));
}
