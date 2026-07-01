import type {
  BugReport,
  BugReportSeverity,
  BugReportStatus,
  PrismaClient,
} from "./generated/prisma/client";
import { toPrismaJsonValue } from "./json-utils";

export type { BugReport, BugReportSeverity, BugReportStatus } from "./generated/prisma/client";

export { BugReportStatus as BugReportStatusEnum } from "./generated/prisma/client";
export { BugReportSeverity as BugReportSeverityEnum } from "./generated/prisma/client";

export const BUG_REPORT_STATUS_LABELS: Record<BugReportStatus, string> = {
  open: "Offen",
  in_progress: "In Bearbeitung",
  resolved: "Behoben",
  wont_fix: "Wird nicht behoben",
};

export const BUG_REPORT_SEVERITY_LABELS: Record<BugReportSeverity, string> = {
  low: "Niedrig",
  medium: "Mittel",
  high: "Hoch",
  critical: "Kritisch",
};

export interface CreateBugReportInput {
  title: string;
  description?: string;
  severity?: BugReportSeverity;
  module?: string | null;
  screenshotAssetId?: string | null;
  reporterUserId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface UpdateBugReportInput {
  title?: string;
  description?: string;
  status?: BugReportStatus;
  severity?: BugReportSeverity;
  module?: string | null;
  screenshotAssetId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ListBugReportsOptions {
  status?: BugReportStatus;
  severity?: BugReportSeverity;
  module?: string;
  limit?: number;
}

export class BugReportService {
  constructor(private readonly db: PrismaClient) {}

  async listReports(options: ListBugReportsOptions = {}): Promise<BugReport[]> {
    return this.db.bugReport.findMany({
      where: {
        ...(options.status ? { status: options.status } : {}),
        ...(options.severity ? { severity: options.severity } : {}),
        ...(options.module ? { module: options.module } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: options.limit ?? 200,
    });
  }

  async getReport(id: string): Promise<BugReport | null> {
    return this.db.bugReport.findUnique({ where: { id } });
  }

  async createReport(input: CreateBugReportInput): Promise<BugReport> {
    const title = input.title.trim();
    if (!title) {
      throw new Error("Titel ist erforderlich.");
    }
    return this.db.bugReport.create({
      data: {
        title,
        description: input.description ?? "",
        severity: input.severity ?? "medium",
        module: input.module ?? null,
        screenshotAssetId: input.screenshotAssetId ?? null,
        reporterUserId: input.reporterUserId ?? null,
        metadata: toPrismaJsonValue(input.metadata),
      },
    });
  }

  async updateReport(id: string, input: UpdateBugReportInput): Promise<BugReport> {
    return this.db.bugReport.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.severity !== undefined ? { severity: input.severity } : {}),
        ...(input.module !== undefined ? { module: input.module } : {}),
        ...(input.screenshotAssetId !== undefined
          ? { screenshotAssetId: input.screenshotAssetId }
          : {}),
        ...(input.metadata !== undefined
          ? { metadata: toPrismaJsonValue(input.metadata) }
          : {}),
      },
    });
  }

  async updateStatus(id: string, status: BugReportStatus): Promise<BugReport> {
    return this.db.bugReport.update({ where: { id }, data: { status } });
  }

  async deleteReport(id: string): Promise<BugReport> {
    return this.db.bugReport.delete({ where: { id } });
  }
}

export function createBugReportService(db: PrismaClient): BugReportService {
  return new BugReportService(db);
}
