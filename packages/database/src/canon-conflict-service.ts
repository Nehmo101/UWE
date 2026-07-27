import type { PrismaClient } from "./client";
import type { CanonicalStatus, PageType, Visibility } from "./generated/prisma/client";
import { buildPageUrl } from "./page-types";
import type { InspectorFinding, InspectorPageInput, InspectorSeverity } from "./world-inspector";

export interface CanonConflictPageInput {
  id: string;
  title: string;
  slug: string;
  type: PageType;
  visibility: Visibility;
  canonicalStatus: CanonicalStatus;
  content: string;
}

export interface BrainFactCanonInput {
  id: string;
  pageId: string | null;
  title: string;
  content: string;
  factType: string;
}

const DEAD_KEYWORDS =
  /\b(tot|dead|deceased|verstorben|gestorben|getötet|killed|fiel im kampf)\b/i;

function studioHref(worldSlug: string, page: { type: PageType; slug: string }): string {
  return buildPageUrl(worldSlug, page.type, page.slug);
}

function findingId(code: string, parts: string[]): string {
  return `${code}:${parts.join(":")}`;
}

function isPortalPublished(page: CanonConflictPageInput): boolean {
  return (
    (page.visibility === "player_visible" || page.visibility === "public")
  );
}

/** Deprecated or non-canon content still visible to players. */
export function checkDeprecatedOrNonCanonPublished(
  worldSlug: string,
  pages: CanonConflictPageInput[],
): InspectorFinding[] {
  const findings: InspectorFinding[] = [];

  for (const page of pages) {
    if (!isPortalPublished(page)) continue;

    if (page.canonicalStatus === "deprecated" || page.canonicalStatus === "non_canon") {
      findings.push({
        id: findingId("deprecated_player_visible", [page.id]),
        code: "deprecated_player_visible",
        severity: "warning",
        message: `„${page.title}" ist ${page.canonicalStatus === "deprecated" ? "veraltet" : "Nicht-Kanon"}, aber im Portal veröffentlicht.`,
        pageTitle: page.title,
        href: studioHref(worldSlug, page),
        pageId: page.id,
        fixes: [{ action: "set_page_dm_only", label: "Auf DM-only setzen" }],
      });
    }

    if (page.canonicalStatus === "idea" || page.canonicalStatus === "draft") {
      findings.push({
        id: findingId("non_canon_portal_published", [page.id]),
        code: "non_canon_portal_published",
        severity: "info",
        message: `„${page.title}" ist noch ${page.canonicalStatus === "idea" ? "Idee" : "Entwurf"}, aber bereits im Portal sichtbar.`,
        pageTitle: page.title,
        href: studioHref(worldSlug, page),
        pageId: page.id,
        fixes: [{ action: "set_page_dm_only", label: "Zurück auf DM-only" }],
      });
    }
  }

  return findings;
}

/** NPC pages whose content marks them dead but remain player-visible. */
export function checkNpcDeathStatusConflicts(
  worldSlug: string,
  pages: CanonConflictPageInput[],
): InspectorFinding[] {
  const findings: InspectorFinding[] = [];

  for (const page of pages) {
    if (page.type !== "npc") continue;
    if (!DEAD_KEYWORDS.test(page.content)) continue;
    if (page.visibility === "dm_only") continue;

    findings.push({
      id: findingId("npc_status_conflict", [page.id]),
      code: "npc_status_conflict",
      severity: "warning",
      message: `NPC „${page.title}" wirkt im Text tot/verstorben, ist aber für Spieler sichtbar oder veröffentlicht.`,
      pageTitle: page.title,
      href: studioHref(worldSlug, page),
      pageId: page.id,
      fixes: [{ action: "set_page_dm_only", label: "Auf DM-only setzen" }],
    });
  }

  return findings;
}

/** Brain facts stating death while linked NPC page stays player-visible. */
export function checkBrainFactDeathConflicts(
  worldSlug: string,
  pages: CanonConflictPageInput[],
  facts: BrainFactCanonInput[],
): InspectorFinding[] {
  const pageById = new Map(pages.map((page) => [page.id, page]));
  const findings: InspectorFinding[] = [];

  for (const fact of facts) {
    if (!fact.pageId || !DEAD_KEYWORDS.test(`${fact.title} ${fact.content}`)) continue;
    const page = pageById.get(fact.pageId);
    if (!page || page.type !== "npc") continue;
    if (!isPortalPublished(page) && page.visibility === "dm_only") continue;

    findings.push({
      id: findingId("brain_fact_death_conflict", [fact.id, page.id]),
      code: "brain_fact_death_conflict",
      severity: "warning",
      message: `Brain-Fakt „${fact.title}" deutet Tod an, aber NPC „${page.title}" ist für Spieler sichtbar.`,
      pageTitle: page.title,
      href: studioHref(worldSlug, page),
      pageId: page.id,
      fixes: [{ action: "set_page_dm_only", label: "NPC auf DM-only setzen" }],
    });
  }

  return findings;
}

/** Terra-specific rule — only when world slug matches. */
export function checkWorldSpecificCanonRules(
  worldSlug: string,
  pages: CanonConflictPageInput[],
): InspectorFinding[] {
  if (worldSlug !== "terra") return [];

  const findings: InspectorFinding[] = [];
  const keywords = ["magister", "nepurga", "turm", "tower"];

  for (const page of pages) {
    const haystack = `${page.title} ${page.content}`.toLowerCase();
    const mentionsTower = keywords.some((keyword) => haystack.includes(keyword));
    const mentionsSquare =
      haystack.includes("eckig") ||
      haystack.includes("quadrat") ||
      haystack.includes("square");

    if (mentionsTower && mentionsSquare) {
      findings.push({
        id: findingId("world_rule_terra_tower", [page.id]),
        code: "world_rule_terra_tower",
        severity: "warning",
        message: `Terra-Kanon: Magister-/Nepurga-Turm-Ebenen sind rund — eckige Beschreibung in „${page.title}".`,
        pageTitle: page.title,
        href: studioHref(worldSlug, page),
        pageId: page.id,
        fixes: [],
      });
    }
  }

  return findings;
}

export function buildGenericCanonConflictFindings(
  worldSlug: string,
  pages: CanonConflictPageInput[],
  facts: BrainFactCanonInput[] = [],
): InspectorFinding[] {
  return [
    ...checkDeprecatedOrNonCanonPublished(worldSlug, pages),
    ...checkNpcDeathStatusConflicts(worldSlug, pages),
    ...checkBrainFactDeathConflicts(worldSlug, pages, facts),
    ...checkWorldSpecificCanonRules(worldSlug, pages),
  ];
}

function toCanonPageInput(page: InspectorPageInput): CanonConflictPageInput {
  return {
    id: page.id,
    title: page.title,
    slug: page.slug,
    type: page.type,
    visibility: page.visibility,
    canonicalStatus: page.canonicalStatus,
    content: page.blocks.map((block) => block.content).join("\n"),
  };
}

export async function getExtendedCanonFindings(
  db: PrismaClient,
  worldSlug: string,
  pages: InspectorPageInput[],
): Promise<InspectorFinding[]> {
  const world = await db.world.findUnique({
    where: { slug: worldSlug },
    select: { id: true },
  });
  if (!world) return [];

  const facts = await db.brainFact.findMany({
    where: { worldId: world.id, status: { not: "deprecated" } },
    select: { id: true, pageId: true, title: true, content: true, factType: true },
    take: 500,
  });

  return buildGenericCanonConflictFindings(
    worldSlug,
    pages.map(toCanonPageInput),
    facts.map((fact) => ({
      id: fact.id,
      pageId: fact.pageId,
      title: fact.title,
      content: fact.content,
      factType: fact.factType,
    })),
  );
}

export function mergeCanonFindings(
  base: InspectorFinding[],
  extended: InspectorFinding[],
): InspectorFinding[] {
  const seen = new Set(base.map((finding) => finding.id));
  const merged = [...base];
  for (const finding of extended) {
    if (seen.has(finding.id)) continue;
    seen.add(finding.id);
    merged.push(finding);
  }
  return merged;
}

export function summarizeCanonSeverity(findings: InspectorFinding[]): Record<InspectorSeverity, number> {
  return findings.reduce(
    (acc, finding) => {
      acc[finding.severity] += 1;
      return acc;
    },
    { critical: 0, warning: 0, info: 0 } as Record<InspectorSeverity, number>,
  );
}
