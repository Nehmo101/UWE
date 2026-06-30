import type { PrismaClient } from "./client";
import { createLifeAdminService } from "./life-admin-service";

export const ADMIN_SEARCH_ENTITY_TYPES = [
  "capture",
  "personal_project",
  "workshop_project",
  "contract_expense",
  "hardware_device",
  "personal_brain_document",
  "personal_brain_fact",
] as const;

export type AdminSearchEntityType = (typeof ADMIN_SEARCH_ENTITY_TYPES)[number];

export const ADMIN_SEARCH_ENTITY_LABELS: Record<AdminSearchEntityType, string> = {
  capture: "Capture",
  personal_project: "Projekt",
  workshop_project: "Werkstatt",
  contract_expense: "Vertrag",
  hardware_device: "Hardware",
  personal_brain_document: "Life Brain",
  personal_brain_fact: "Life Brain Fakt",
};

export interface AdminSearchOptions {
  query: string;
  entityType?: AdminSearchEntityType;
  limit?: number;
}

export interface AdminSearchResultItem {
  id: string;
  entityType: AdminSearchEntityType;
  title: string;
  snippet: string | null;
  href: string;
  group: string;
  score: number;
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function scoreMatch(text: string | null | undefined, query: string): number {
  if (!text) return 0;
  const lower = text.toLowerCase();
  if (lower === query) return 100;
  if (lower.startsWith(query)) return 80;
  if (lower.includes(query)) return 50;
  return 0;
}

function bestScore(fields: Array<string | null | undefined>, query: string): number {
  return fields.reduce((max, field) => Math.max(max, scoreMatch(field, query)), 0);
}

function snippetFrom(text: string | null | undefined, query: string, maxLength = 120): string | null {
  if (!text?.trim()) return null;
  const lower = text.toLowerCase();
  const index = lower.indexOf(query);
  if (index < 0) {
    return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
  }
  const start = Math.max(0, index - 30);
  const excerpt = text.slice(start, start + maxLength);
  return start > 0 ? `…${excerpt}` : excerpt;
}

function hrefFor(type: AdminSearchEntityType, id: string): string {
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
  }
}

export async function searchAdminEntities(
  db: PrismaClient,
  options: AdminSearchOptions,
): Promise<AdminSearchResultItem[]> {
  const query = normalizeQuery(options.query);
  if (query.length < 2) {
    return [];
  }

  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
  const perTypeLimit = Math.max(limit, 12);
  const entityFilter = options.entityType;
  const results: AdminSearchResultItem[] = [];

  if (!entityFilter || entityFilter === "capture") {
    const captures = await db.captureEntry.findMany({
      where: {
        OR: [
          { title: { contains: query } },
          { content: { contains: query } },
          { url: { contains: query } },
        ],
      },
      orderBy: [{ capturedAt: "desc" }],
      take: perTypeLimit,
    });
    for (const capture of captures) {
      const score = bestScore([capture.title, capture.content, capture.url], query);
      if (score <= 0) continue;
      results.push({
        id: capture.id,
        entityType: "capture",
        title: capture.title || "Capture",
        snippet: snippetFrom(capture.content || capture.url, query),
        href: hrefFor("capture", capture.id),
        group: "Persönlich · Capture",
        score,
      });
    }
  }

  if (!entityFilter || entityFilter === "personal_project") {
    const projects = await db.personalProject.findMany({
      where: {
        OR: [
          { name: { contains: query } },
          { description: { contains: query } },
          { nextAction: { contains: query } },
          { notes: { contains: query } },
        ],
      },
      orderBy: [{ updatedAt: "desc" }],
      take: perTypeLimit,
    });
    for (const project of projects) {
      const score = bestScore([project.name, project.description, project.nextAction, project.notes], query);
      if (score <= 0) continue;
      results.push({
        id: project.id,
        entityType: "personal_project",
        title: project.name,
        snippet: snippetFrom(project.nextAction || project.description, query),
        href: hrefFor("personal_project", project.id),
        group: "Persönlich · Projekte",
        score,
      });
    }
  }

  if (!entityFilter || entityFilter === "workshop_project") {
    const workshops = await db.workshopProject.findMany({
      where: {
        OR: [
          { title: { contains: query } },
          { description: { contains: query } },
          { nextAction: { contains: query } },
          { notes: { contains: query } },
        ],
      },
      orderBy: [{ updatedAt: "desc" }],
      take: perTypeLimit,
    });
    for (const workshop of workshops) {
      const score = bestScore([workshop.title, workshop.description, workshop.nextAction, workshop.notes], query);
      if (score <= 0) continue;
      results.push({
        id: workshop.id,
        entityType: "workshop_project",
        title: workshop.title,
        snippet: snippetFrom(workshop.nextAction || workshop.description, query),
        href: hrefFor("workshop_project", workshop.id),
        group: "Persönlich · Werkstatt",
        score,
      });
    }
  }

  if (!entityFilter || entityFilter === "contract_expense") {
    const contracts = await db.contractExpense.findMany({
      where: {
        OR: [
          { name: { contains: query } },
          { vendor: { contains: query } },
          { notes: { contains: query } },
          { categoryLabel: { contains: query } },
        ],
      },
      orderBy: [{ updatedAt: "desc" }],
      take: perTypeLimit,
    });
    for (const contract of contracts) {
      const score = bestScore([contract.name, contract.vendor, contract.notes, contract.categoryLabel], query);
      if (score <= 0) continue;
      results.push({
        id: contract.id,
        entityType: "contract_expense",
        title: contract.name,
        snippet: snippetFrom(contract.vendor || contract.notes, query),
        href: hrefFor("contract_expense", contract.id),
        group: "Persönlich · Verträge",
        score,
      });
    }
  }

  if (!entityFilter || entityFilter === "hardware_device") {
    const devices = await db.hardwareDevice.findMany({
      where: {
        OR: [
          { name: { contains: query } },
          { role: { contains: query } },
          { notes: { contains: query } },
          { errorNotes: { contains: query } },
        ],
      },
      orderBy: [{ updatedAt: "desc" }],
      take: perTypeLimit,
    });
    for (const device of devices) {
      const score = bestScore([device.name, device.role, device.notes, device.errorNotes], query);
      if (score <= 0) continue;
      results.push({
        id: device.id,
        entityType: "hardware_device",
        title: device.name,
        snippet: snippetFrom(device.notes || device.errorNotes, query),
        href: hrefFor("hardware_device", device.id),
        group: "Persönlich · Hardware",
        score,
      });
    }
  }

  if (
    !entityFilter ||
    entityFilter === "personal_brain_document" ||
    entityFilter === "personal_brain_fact"
  ) {
    const lifeAdmin = createLifeAdminService(db);
    const brainSearch = await lifeAdmin.searchPersonalBrain({ query, limit: perTypeLimit });

    if (!entityFilter || entityFilter === "personal_brain_document") {
      for (const hit of brainSearch.documents) {
        const score = Math.round(hit.score * 100);
        if (score <= 0) continue;
        results.push({
          id: hit.item.id,
          entityType: "personal_brain_document",
          title: hit.item.title,
          snippet: snippetFrom(hit.item.content, query),
          href: hrefFor("personal_brain_document", hit.item.id),
          group: "Persönlich · Life Brain",
          score,
        });
      }
    }

    if (!entityFilter || entityFilter === "personal_brain_fact") {
      for (const hit of brainSearch.facts) {
        const score = Math.round(hit.score * 100);
        if (score <= 0) continue;
        results.push({
          id: hit.item.id,
          entityType: "personal_brain_fact",
          title: hit.item.title,
          snippet: snippetFrom(hit.item.content, query),
          href: hrefFor("personal_brain_fact", hit.item.id),
          group: "Persönlich · Life Brain",
          score,
        });
      }
    }
  }

  return results.sort((left, right) => right.score - left.score || left.title.localeCompare(right.title)).slice(0, limit);
}
