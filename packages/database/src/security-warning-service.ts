import type { PrismaClient } from "./client";
import type { SecurityWarningSeverity } from "./generated/prisma/client";
import { buildSecurityWarnings, type SecurityWarning as RuntimeSecurityWarning } from "./security-dashboard";

export interface PersistedSecurityWarning {
  id: string;
  code: string;
  severity: SecurityWarningSeverity;
  title: string;
  description: string;
  dismissedAt: Date | null;
  detectedAt: Date;
}

export class SecurityWarningService {
  constructor(private readonly db: PrismaClient) {}

  async syncRuntimeWarnings(runtimeWarnings: RuntimeSecurityWarning[]): Promise<void> {
    for (const warning of runtimeWarnings) {
      await this.db.securityWarning.upsert({
        where: { code: warning.id },
        create: {
          code: warning.id,
          severity: warning.severity,
          title: warning.title,
          description: warning.description,
        },
        update: {
          severity: warning.severity,
          title: warning.title,
          description: warning.description,
        },
      });
    }
  }

  async listActive(): Promise<PersistedSecurityWarning[]> {
    const warnings = await this.db.securityWarning.findMany({
      where: { dismissedAt: null },
      orderBy: [{ severity: "desc" }, { detectedAt: "desc" }],
    });
    return warnings;
  }

  async dismiss(code: string, dismissedById: string): Promise<void> {
    await this.db.securityWarning.update({
      where: { code },
      data: {
        dismissedAt: new Date(),
        dismissedById,
      },
    });
  }
}

export async function syncSecurityWarningsFromDashboard(
  db: PrismaClient,
  input: Parameters<typeof buildSecurityWarnings>[0],
): Promise<PersistedSecurityWarning[]> {
  const runtime = buildSecurityWarnings(input);
  const service = new SecurityWarningService(db);
  await service.syncRuntimeWarnings(runtime);
  return service.listActive();
}

export function createSecurityWarningService(db: PrismaClient): SecurityWarningService {
  return new SecurityWarningService(db);
}
