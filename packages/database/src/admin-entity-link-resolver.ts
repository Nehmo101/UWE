import type { PrismaClient } from "./client";
import type { BrainPrismaClient } from "./brain-client";
import type {
  AdminEntityLink,
  AdminLinkSourceType,
  AdminLinkTargetType,
} from "./generated/prisma-brain/client";
// Die Family-Modelle (Vertraege, Dokumente, Kueche, Haushalt, Kalender,
// Scan-Eingang) liegen seit Abschnitt G in uwe-family.db. Der Singleton statt
// eines weiteren Konstruktor-Parameters: sonst muesste jede Aufrufstelle im
// Repo einen dritten Client durchreichen.
import { familyPrisma } from "./family-client";

export const ADMIN_LINK_RELATION_LABELS: Record<string, string> = {
  promoted_to: "Übernommen aus",
  related: "Verknüpft mit",
};

export const ADMIN_LINK_SOURCE_LABELS: Record<AdminLinkSourceType, string> = {
  capture: "Capture",
  personal_project: "Projekt",
  workshop_project: "Werkstatt",
  contract_expense: "Vertrag",
  hardware_device: "Hardware",
  personal_brain_document: "Life Brain Dokument",
  personal_brain_fact: "Life Brain Fakt",
  scan_document: "Scan",
};

export const ADMIN_LINK_TARGET_LABELS: Record<AdminLinkTargetType, string> = {
  capture: "Capture",
  personal_project: "Projekt",
  workshop_project: "Werkstatt",
  contract_expense: "Vertrag",
  hardware_device: "Hardware",
  personal_brain_document: "Life Brain Dokument",
  personal_brain_fact: "Life Brain Fakt",
  world: "Welt",
  page: "Wiki-Seite",
  asset: "Asset",
  scan_document: "Scan",
};

export interface ResolvedAdminEntityLink {
  id: string;
  direction: "outgoing" | "incoming";
  relationType: string;
  relationLabel: string;
  entityType: string;
  entityLabel: string;
  title: string;
  href: string | null;
}

function studioHrefForEntity(
  type: AdminLinkSourceType | AdminLinkTargetType,
  id: string,
  extras?: { worldSlug?: string | null },
): string | null {
  switch (type) {
    case "capture":
      return `/capture/${id}`;
    case "personal_project":
      return `/projects/${id}`;
    case "workshop_project":
      return `/workshop/${id}`;
    case "contract_expense":
      return "/contracts";
    case "hardware_device":
      return "/hardware";
    case "personal_brain_document":
      return `/life-brain/documents/${id}`;
    case "personal_brain_fact":
      return `/life-brain/facts/${id}`;
    case "world":
      return extras?.worldSlug ? `/worlds/${extras.worldSlug}/dashboard` : "/worlds";
    case "page":
      return extras?.worldSlug ? `/worlds/${extras.worldSlug}` : null;
    case "asset":
      return null;
    default:
      return null;
  }
}

async function resolveEntityTitle(
  db: PrismaClient,
  brainDb: BrainPrismaClient,
  type: AdminLinkSourceType | AdminLinkTargetType,
  id: string,
): Promise<{ title: string; worldSlug?: string | null }> {
  switch (type) {
    case "capture": {
      const capture = await brainDb.captureEntry.findUnique({ where: { id }, select: { title: true } });
      return { title: capture?.title || "Capture" };
    }
    case "personal_project": {
      const project = await brainDb.personalProject.findUnique({ where: { id }, select: { name: true } });
      return { title: project?.name || "Projekt" };
    }
    case "workshop_project": {
      const workshop = await brainDb.workshopProject.findUnique({ where: { id }, select: { title: true } });
      return { title: workshop?.title || "Werkstatt" };
    }
    case "contract_expense": {
      const contract = await familyPrisma.contractExpense.findUnique({ where: { id }, select: { name: true } });
      return { title: contract?.name || "Vertrag" };
    }
    case "hardware_device": {
      const device = await brainDb.hardwareDevice.findUnique({ where: { id }, select: { name: true } });
      return { title: device?.name || "Hardware" };
    }
    case "personal_brain_document": {
      const doc = await brainDb.personalBrainDocument.findUnique({ where: { id }, select: { title: true } });
      return { title: doc?.title || "Dokument" };
    }
    case "personal_brain_fact": {
      const fact = await brainDb.personalBrainFact.findUnique({ where: { id }, select: { title: true } });
      return { title: fact?.title || "Fakt" };
    }
    case "world": {
      const world = await db.world.findUnique({ where: { id }, select: { name: true, slug: true } });
      return { title: world?.name || "Welt", worldSlug: world?.slug ?? null };
    }
    case "page": {
      const page = await db.page.findUnique({
        where: { id },
        select: { title: true, world: { select: { slug: true } } },
      });
      return { title: page?.title || "Seite", worldSlug: page?.world.slug ?? null };
    }
    case "asset": {
      const asset = await db.asset.findUnique({ where: { id }, select: { title: true } });
      return { title: asset?.title || "Asset" };
    }
    default:
      return { title: id };
  }
}

export async function resolveAdminEntityLinks(
  db: PrismaClient,
  brainDb: BrainPrismaClient,
  links: AdminEntityLink[],
  perspective: { sourceType: AdminLinkSourceType; sourceId: string },
): Promise<ResolvedAdminEntityLink[]> {
  const resolved: ResolvedAdminEntityLink[] = [];

  for (const link of links) {
    const outgoing = link.sourceType === perspective.sourceType && link.sourceId === perspective.sourceId;
    const targetType = outgoing ? link.targetType : link.sourceType;
    const targetId = outgoing ? link.targetId : link.sourceId;
    const { title, worldSlug } = await resolveEntityTitle(db, brainDb, targetType, targetId);

    resolved.push({
      id: link.id,
      direction: outgoing ? "outgoing" : "incoming",
      relationType: link.relationType,
      relationLabel: ADMIN_LINK_RELATION_LABELS[link.relationType] ?? link.relationType,
      entityType: ADMIN_LINK_TARGET_LABELS[targetType] ?? targetType,
      entityLabel: link.label ?? ADMIN_LINK_TARGET_LABELS[targetType] ?? targetType,
      title,
      href: studioHrefForEntity(targetType, targetId, { worldSlug }),
    });
  }

  return resolved;
}

export async function listResolvedAdminLinksForEntity(
  db: PrismaClient,
  brainDb: BrainPrismaClient,
  sourceType: AdminLinkSourceType,
  sourceId: string,
): Promise<ResolvedAdminEntityLink[]> {
  const [outgoing, incoming] = await Promise.all([
    brainDb.adminEntityLink.findMany({
      where: { sourceType, sourceId },
      orderBy: [{ createdAt: "desc" }],
    }),
    brainDb.adminEntityLink.findMany({
      where: { targetType: sourceType as AdminLinkTargetType, targetId: sourceId },
      orderBy: [{ createdAt: "desc" }],
    }),
  ]);

  const outgoingResolved = await resolveAdminEntityLinks(db, brainDb, outgoing, { sourceType, sourceId });
  const incomingResolved = await resolveAdminEntityLinks(db, brainDb, incoming, { sourceType, sourceId });
  return [...outgoingResolved, ...incomingResolved];
}
