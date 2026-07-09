import type { PrismaClient } from "./client";
import { createLifeAdminService } from "./life-admin-service";
import { parseTagsFromMetadata } from "./json-utils";

export const ADMIN_SEARCH_ENTITY_TYPES = [
  "capture",
  "personal_project",
  "workshop_project",
  "contract_expense",
  "hardware_device",
  "personal_brain_document",
  "personal_brain_fact",
  "dev_idea",
  "document_template",
  "scan_document",
  "prompt_template",
  "bug_report",
  "shopping_list",
  "mail_template",
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
  dev_idea: "Dev-Idee",
  document_template: "Dokumentenvorlage",
  scan_document: "Scan Inbox",
  prompt_template: "Prompt",
  bug_report: "Bug",
  shopping_list: "Einkaufsliste",
  mail_template: "Mail-Vorlage",
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
    case "dev_idea":
      return `/ideas?idea=${id}`;
    case "document_template":
      return "/documents";
    case "scan_document":
      return `/scan-inbox/${id}`;
    case "prompt_template":
      return `/prompts/${id}`;
    case "bug_report":
      return "/bugs";
    case "shopping_list":
      return `/kitchen/shopping?list=${id}`;
    case "mail_template":
      return "/mail";
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

  if (!entityFilter || entityFilter === "dev_idea") {
    const ideas = await db.devIdea.findMany({
      where: {
        OR: [
          { title: { contains: query } },
          { body: { contains: query } },
          { module: { contains: query } },
          { generatedPrompt: { contains: query } },
        ],
      },
      orderBy: [{ updatedAt: "desc" }],
      take: perTypeLimit,
    });
    for (const idea of ideas) {
      const metadataTags = parseTagsFromMetadata(idea.metadata);
      const score = bestScore(
        [idea.title, idea.body, idea.module, idea.generatedPrompt, ...metadataTags],
        query,
      );
      if (score <= 0) continue;
      results.push({
        id: idea.id,
        entityType: "dev_idea",
        title: idea.title,
        snippet: snippetFrom(idea.body, query),
        href: hrefFor("dev_idea", idea.id),
        group: "Persönlich · Dev-Ideen",
        score,
      });
    }
  }

  if (!entityFilter || entityFilter === "document_template") {
    const templates = await db.documentTemplate.findMany({
      where: {
        OR: [
          { name: { contains: query } },
          { body: { contains: query } },
        ],
      },
      orderBy: [{ updatedAt: "desc" }],
      take: perTypeLimit,
    });
    for (const template of templates) {
      const score = bestScore([template.name, template.body], query);
      if (score <= 0) continue;
      results.push({
        id: template.id,
        entityType: "document_template",
        title: template.name,
        snippet: snippetFrom(template.body, query),
        href: hrefFor("document_template", template.id),
        group: "Organisation · Dokumente",
        score,
      });
    }
  }

  if (!entityFilter || entityFilter === "scan_document") {
    const scans = await db.scanDocument.findMany({
      where: {
        OR: [
          { title: { contains: query } },
          { ocrText: { contains: query } },
          { storageKey: { contains: query } },
        ],
      },
      orderBy: [{ createdAt: "desc" }],
      take: perTypeLimit,
    });
    for (const scan of scans) {
      const score = bestScore([scan.title, scan.ocrText, scan.storageKey], query);
      if (score <= 0) continue;
      results.push({
        id: scan.id,
        entityType: "scan_document",
        title: scan.title || "Scan",
        snippet: snippetFrom(scan.ocrText, query),
        href: hrefFor("scan_document", scan.id),
        group: "Organisation · Scan Inbox",
        score,
      });
    }
  }

  if (!entityFilter || entityFilter === "prompt_template") {
    const prompts = await db.promptTemplate.findMany({
      where: {
        OR: [
          { title: { contains: query } },
          { description: { contains: query } },
          { body: { contains: query } },
        ],
      },
      orderBy: [{ updatedAt: "desc" }],
      take: perTypeLimit,
    });
    for (const prompt of prompts) {
      const score = bestScore([prompt.title, prompt.description, prompt.body], query);
      if (score <= 0) continue;
      results.push({
        id: prompt.id,
        entityType: "prompt_template",
        title: prompt.title,
        snippet: snippetFrom(prompt.description || prompt.body, query),
        href: hrefFor("prompt_template", prompt.id),
        group: "AI · Prompt-Bibliothek",
        score,
      });
    }
  }

  if (!entityFilter || entityFilter === "bug_report") {
    const bugs = await db.bugReport.findMany({
      where: {
        OR: [
          { title: { contains: query } },
          { description: { contains: query } },
          { module: { contains: query } },
        ],
      },
      orderBy: [{ updatedAt: "desc" }],
      take: perTypeLimit,
    });
    for (const bug of bugs) {
      const score = bestScore([bug.title, bug.description, bug.module], query);
      if (score <= 0) continue;
      results.push({
        id: bug.id,
        entityType: "bug_report",
        title: bug.title,
        snippet: snippetFrom(bug.description, query),
        href: hrefFor("bug_report", bug.id),
        group: "System · Bugs",
        score,
      });
    }
  }

  if (!entityFilter || entityFilter === "shopping_list") {
    const lists = await db.shoppingList.findMany({
      where: {
        OR: [
          { title: { contains: query } },
          { items: { some: { name: { contains: query } } } },
        ],
      },
      orderBy: [{ createdAt: "desc" }],
      take: perTypeLimit,
      include: { items: { take: 3, orderBy: { sortIndex: "asc" } } },
    });
    for (const list of lists) {
      const itemNames = list.items.map((item) => item.name);
      const score = bestScore([list.title, ...itemNames], query);
      if (score <= 0) continue;
      results.push({
        id: list.id,
        entityType: "shopping_list",
        title: list.title,
        snippet: itemNames.length > 0 ? `Enthält: ${itemNames.join(", ")}` : null,
        href: hrefFor("shopping_list", list.id),
        group: "Werkzeuge · Küche",
        score,
      });
    }
  }

  if (!entityFilter || entityFilter === "mail_template") {
    const mailTemplates = await db.mailTemplate.findMany({
      where: {
        OR: [
          { name: { contains: query } },
          { description: { contains: query } },
          { subject: { contains: query } },
          { bodyText: { contains: query } },
        ],
      },
      orderBy: [{ updatedAt: "desc" }],
      take: perTypeLimit,
    });
    for (const template of mailTemplates) {
      const score = bestScore(
        [template.name, template.description, template.subject, template.bodyText],
        query,
      );
      if (score <= 0) continue;
      results.push({
        id: template.id,
        entityType: "mail_template",
        title: template.name,
        snippet: snippetFrom(template.subject || template.description, query),
        href: hrefFor("mail_template", template.id),
        group: "Organisation · Mail",
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
