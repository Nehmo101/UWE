import type { PrismaClient } from "@uwe/database/server";
import {
  getAdminStatus,
  scanPublicContentLeaks,
  type AdminStatus,
  type PublicLeakScanResult,
} from "@uwe/database/server";
import { validateUweEnvironment, type EnvValidationIssue } from "@uwe/auth";
import { checkRtxReadiness, type RtxReadinessStatus } from "@uwe/ai-brain/router";
import { getInferenceStatus, type InferenceStatus } from "@uwe/ai-brain/inference";

export interface AdminDashboardStatus extends AdminStatus {
  inference: InferenceStatus;
  rtx: RtxReadinessStatus;
  envValidation: EnvValidationIssue[];
  publicLeaks: PublicLeakScanResult;
}

export async function getAdminDashboardStatus(
  db: PrismaClient,
  options: { rateLimiterMode?: string; useMockInference?: boolean } = {},
): Promise<AdminDashboardStatus> {
  const [admin, inference, rtx, publicLeaks] = await Promise.all([
    getAdminStatus(db, brainPrisma, { rateLimiterMode: options.rateLimiterMode }),
    getInferenceStatus({ useMock: options.useMockInference }),
    checkRtxReadiness({ useMock: options.useMockInference, prisma: db }),
    scanPublicContentLeaks(db),
  ]);

  const envValidation = validateUweEnvironment();

  const inferenceBlocksOk = !inference.enabled || rtx.ready || inference.online;
  const securityBlocksOk =
    admin.studioSecurity.severity !== "critical" &&
    admin.rtxExposure.severity !== "critical" &&
    publicLeaks.criticalCount === 0;
  const ok = admin.ok && inferenceBlocksOk && securityBlocksOk;

  return {
    ...admin,
    ok,
    inference,
    rtx,
    envValidation,
    publicLeaks,
  };
}

export type { InferenceStatus, RtxReadinessStatus as RtxHealthStatus };
