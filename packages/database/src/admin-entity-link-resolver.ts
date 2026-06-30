import type { PrismaClient } from "./client";
import type {
  AdminEntityLink,
  AdminLinkSourceType,
  AdminLinkTargetType,
} from "./generated/prisma/client";

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
  type: AdminLinkSourceType | AdminLinkTargetType,
  id: string,
): Promise<{ title: string; worldSlug?: string | null }> {
  switch (type) {
    case "capture": {
      const capture = await db.captureEntry.findUnique({ where: { id }, select: { title: true } });
      return { title: capture?.title || "Capture" };
    }
    case "personal_project": {
      const project = await db.personalProject.findUnique({ where: { id }, select: { name: true } });
      return { title: project?.name || "Projekt" };
    }
    case "workshop_project": {
      const workshop = await db.workshopProject.findUnique({ where: { id }, select: { title: true } });
      return { title: workshop?.title || "Werkstatt" };
    }
    case "contract_expense": {
      const contract = await db.contractExpense.findUnique({ where: { id }, select: { name: true } });
      return { title: contract?.name || "Vertrag" };
    }
    case "hardware_device": {
      const device = await db.hardwareDevice.findUnique({ where: { id }, select: { name: true } });
      return { title: device?.name || "Hardware" };
    }
    case "personal_brain_document": {
      const doc = await db.personalBrainDocument.findUnique({ where: { id }, select: { title: true } });
      return { title: doc?.title || "Dokument" };
    }
    case "personal_brain_fact": {
      const fact = await db.personalBrainFact.findUnique({ where: { id }, select: { title: true } });
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
  links: AdminEntityLink[],
  perspective: { sourceType: AdminLinkSourceType; sourceId: string },
): Promise<ResolvedAdminEntityLink[]> {
  const resolved: ResolvedAdminEntityLink[] = [];

  for (const link of links) {
    const outgoing = link.sourceType === perspective.sourceType && link.sourceId === perspective.sourceId;
    const targetType = outgoing ? link.targetType : link.sourceType;
    const targetId = outgoing ? link.targetId : link.sourceId;
    const { title, worldSlug } = await resolveEntityTitle(db, targetType, targetId);

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
  sourceType: AdminLinkSourceType,
  sourceId: string,
): Promise<ResolvedAdminEntityLink[]> {
  const [outgoing, incoming] = await Promise.all([
    db.adminEntityLink.findMany({
      where: { sourceType, sourceId },
      orderBy: [{ createdAt: "desc" }],
    }),
    db.adminEntityLink.findMany({
      where: { targetType: sourceType as AdminLinkTargetType, targetId: sourceId },
      orderBy: [{ createdAt: "desc" }],
    }),
  ]);

  const outgoingResolved = await resolveAdminEntityLinks(db, outgoing, { sourceType, sourceId });
  const incomingResolved = await resolveAdminEntityLinks(db, incoming, { sourceType, sourceId });
  return [...outgoingResolved, ...incomingResolved];
}
