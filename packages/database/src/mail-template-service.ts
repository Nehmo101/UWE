import type { BrainPrismaClient as PrismaClient } from "./brain-client";
import { slugifyMailKey } from "./mail-utils";
import type { MailTemplateKind } from "./generated/prisma-brain/client";
import { runSeedOnce } from "./seed-tracker";

export const MAIL_TEMPLATE_SEED_KEY = "mail_templates.system";
export const MAIL_TEMPLATE_SEED_VERSION = 2;

export interface MailTemplateView {
  id: string;
  worldId: string | null;
  kind: MailTemplateKind;
  slug: string;
  name: string;
  description: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  isSystem: boolean;
  isActive: boolean;
  updatedAt: Date;
}

export interface MailTemplateInput {
  slug?: string;
  kind?: MailTemplateKind;
  name: string;
  description?: string;
  subject: string;
  bodyHtml?: string;
  bodyText?: string;
  isActive?: boolean;
}

const SYSTEM_TEMPLATES: Array<{
  slug: string;
  kind: MailTemplateKind;
  name: string;
  description: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
}> = [
  {
    slug: "session-recap",
    kind: "session_recap",
    name: "Session-Recap",
    description: "Spieler-sichtbare Session-Zusammenfassung.",
    subject: "Session-Recap: {{sessionTitle}}",
    bodyHtml: "<h2>Session {{sessionNumber}}: {{sessionTitle}}</h2>\n<p>{{summaryPlayer}}</p>",
    bodyText: "Session {{sessionNumber}}: {{sessionTitle}}\n\n{{summaryPlayer}}",
  },
  {
    slug: "handout",
    kind: "handout",
    name: "Handout",
    description: "Handout an Spieler verteilen.",
    subject: "Handout: {{title}}",
    bodyHtml: "<h2>{{title}}</h2>\n<p>{{description}}</p>",
    bodyText: "{{title}}\n\n{{description}}",
  },
  {
    slug: "share-link",
    kind: "share_link",
    name: "Player-Preview-Link",
    description: "Freigabe-Link für Spieler-Vorschau.",
    subject: "Vorschau: {{targetLabel}}",
    bodyHtml: "<h2>{{targetLabel}}</h2>\n<p><a href=\"{{publicUrl}}\">{{publicUrl}}</a></p>",
    bodyText: "{{targetLabel}}\n\nVorschau-Link: {{publicUrl}}",
  },
  {
    slug: "session-reminder",
    kind: "session_reminder",
    name: "Session-Erinnerung",
    description: "Erinnerung an die nächste Spielsession.",
    subject: "Session-Erinnerung: {{sessionTitle}}",
    bodyHtml:
      "<h2>Session {{sessionNumber}}: {{sessionTitle}}</h2>\n<p>Termin: {{sessionDate}}</p>\n<p>Bitte bestätige deine Teilnahme.</p>",
    bodyText:
      "Session {{sessionNumber}}: {{sessionTitle}}\n\nTermin: {{sessionDate}}\n\nBitte bestätige deine Teilnahme.",
  },
  {
    slug: "contract-reminder",
    kind: "contract_reminder",
    name: "Vertragserinnerung",
    description: "Erinnerung an Kündigungsfrist oder Zahlung.",
    subject: "Vertrag: {{contractName}}",
    bodyHtml:
      "<h2>{{contractName}}</h2>\n<p>{{reminderMessage}}</p>\n<p>Fällig: {{dueDate}}</p>",
    bodyText: "{{contractName}}\n\n{{reminderMessage}}\n\nFällig: {{dueDate}}",
  },
  {
    slug: "backup-warning",
    kind: "backup_warning",
    name: "Backup-Warnung",
    description: "Hinweis auf fehlendes oder veraltetes Backup.",
    subject: "UWE Backup-Prüfung",
    bodyHtml:
      "<h2>Backup-Prüfung</h2>\n<p>{{message}}</p>\n<p>Letztes Backup: {{lastBackupAt}}</p>",
    bodyText: "Backup-Prüfung\n\n{{message}}\n\nLetztes Backup: {{lastBackupAt}}",
  },
  {
    slug: "system-warning",
    kind: "system_warning",
    name: "Systemwarnung",
    description: "Allgemeine Systemwarnung aus dem Admin-Cockpit.",
    subject: "UWE Systemhinweis: {{title}}",
    bodyHtml: "<h2>{{title}}</h2>\n<p>{{message}}</p>",
    bodyText: "{{title}}\n\n{{message}}",
  },
  {
    slug: "terrain-rental",
    kind: "terrain_rental",
    name: "Terrain-Verleih",
    description: "Anfrage oder Antwort zum Terrain-Verleih.",
    subject: "Terrain-Verleih: {{projectTitle}}",
    bodyHtml:
      "<h2>{{projectTitle}}</h2>\n<p>{{message}}</p>\n<p>Status: {{status}}</p>",
    bodyText: "{{projectTitle}}\n\n{{message}}\n\nStatus: {{status}}",
  },
];

function toView(record: {
  id: string;
  worldId: string | null;
  kind: MailTemplateKind;
  slug: string;
  name: string;
  description: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  isSystem: boolean;
  isActive: boolean;
  updatedAt: Date;
}): MailTemplateView {
  return {
    id: record.id,
    worldId: record.worldId,
    kind: record.kind,
    slug: record.slug,
    name: record.name,
    description: record.description,
    subject: record.subject,
    bodyHtml: record.bodyHtml,
    bodyText: record.bodyText,
    isSystem: record.isSystem,
    isActive: record.isActive,
    updatedAt: record.updatedAt,
  };
}

export class MailTemplateService {
  constructor(private readonly db: PrismaClient) {}

  async ensureSystemTemplatesSeeded(): Promise<{ applied: boolean }> {
    return runSeedOnce(this.db, MAIL_TEMPLATE_SEED_KEY, MAIL_TEMPLATE_SEED_VERSION, async () => {
      for (const template of SYSTEM_TEMPLATES) {
        const existing = await this.db.mailTemplate.findFirst({
          where: { worldId: null, slug: template.slug },
        });

        if (!existing) {
          await this.db.mailTemplate.create({
            data: {
              worldId: null,
              slug: template.slug,
              kind: template.kind,
              name: template.name,
              description: template.description,
              subject: template.subject,
              bodyHtml: template.bodyHtml,
              bodyText: template.bodyText,
              isSystem: true,
              isActive: true,
            },
          });
        }
      }
    });
  }

  async listTemplates(options?: {
    worldId?: string | null;
    includeInactive?: boolean;
  }): Promise<MailTemplateView[]> {
    await this.ensureSystemTemplatesSeeded();

    const records = await this.db.mailTemplate.findMany({
      where: {
        ...(options?.includeInactive ? {} : { isActive: true }),
        OR: [
          { worldId: null },
          ...(options?.worldId ? [{ worldId: options.worldId }] : []),
        ],
      },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    });

    return records.map(toView);
  }

  async getTemplate(slug: string, worldId?: string | null): Promise<MailTemplateView | null> {
    await this.ensureSystemTemplatesSeeded();

    const record =
      (worldId
        ? await this.db.mailTemplate.findUnique({
            where: { worldId_slug: { worldId, slug } },
          })
        : null) ??
      (await this.db.mailTemplate.findFirst({
        where: { worldId: null, slug },
      }));

    return record ? toView(record) : null;
  }

  async createTemplate(worldId: string, input: MailTemplateInput): Promise<MailTemplateView> {
    const slug = input.slug?.trim() || slugifyMailKey(input.name, "template");

    const record = await this.db.mailTemplate.create({
      data: {
        worldId,
        slug,
        kind: input.kind ?? "custom",
        name: input.name.trim(),
        description: input.description?.trim() ?? "",
        subject: input.subject.trim(),
        bodyHtml: input.bodyHtml?.trim() ?? "",
        bodyText: input.bodyText?.trim() ?? "",
        isSystem: false,
        isActive: input.isActive ?? true,
      },
    });

    return toView(record);
  }

  async updateTemplate(
    worldId: string,
    slug: string,
    input: Partial<MailTemplateInput>,
  ): Promise<MailTemplateView> {
    const existing = await this.db.mailTemplate.findUnique({
      where: { worldId_slug: { worldId, slug } },
    });

    if (!existing) {
      throw new Error("Mail-Template nicht gefunden.");
    }

    const record = await this.db.mailTemplate.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description.trim() } : {}),
        ...(input.subject !== undefined ? { subject: input.subject.trim() } : {}),
        ...(input.bodyHtml !== undefined ? { bodyHtml: input.bodyHtml.trim() } : {}),
        ...(input.bodyText !== undefined ? { bodyText: input.bodyText.trim() } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.kind !== undefined ? { kind: input.kind } : {}),
      },
    });

    return toView(record);
  }
}

export function createMailTemplateService(db: PrismaClient): MailTemplateService {
  return new MailTemplateService(db);
}

export async function ensureSystemMailTemplates(db: PrismaClient): Promise<{ applied: boolean }> {
  return createMailTemplateService(brainPrisma, db).ensureSystemTemplatesSeeded();
}
