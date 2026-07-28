import type { PrismaClient } from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import {
  getAdminStatus,
  type AdminStatus,
} from "@uwe/database/server";
import { validateUweEnvironment, type EnvValidationIssue } from "@uwe/auth";
import { checkRtxReadiness, type RtxReadinessStatus } from "@uwe/ai-brain/router";
import { getInferenceStatus, type InferenceStatus } from "@uwe/ai-brain/inference";

export interface AdminDashboardStatus extends AdminStatus {
  inference: InferenceStatus;
  rtx: RtxReadinessStatus;
  envValidation: EnvValidationIssue[];
}

export async function getAdminDashboardStatus(
  db: PrismaClient,
  options: { rateLimiterMode?: string; useMockInference?: boolean } = {},
): Promise<AdminDashboardStatus> {
  const [admin, inference, rtx] = await Promise.all([
    getAdminStatus(db, brainPrisma, { rateLimiterMode: options.rateLimiterMode }),
    getInferenceStatus({ useMock: options.useMockInference }),
    checkRtxReadiness({ useMock: options.useMockInference, prisma: db }),
  ]);

  const envValidation = validateUweEnvironment();

  const inferenceBlocksOk = !inference.enabled || rtx.ready || inference.online;
  const securityBlocksOk =
    admin.studioSecurity.severity !== "critical" &&
    admin.rtxExposure.severity !== "critical";
  const ok = admin.ok && inferenceBlocksOk && securityBlocksOk;

  return {
    ...admin,
    ok,
    inference,
    rtx,
    envValidation,
  };
}

export type { InferenceStatus, RtxReadinessStatus as RtxHealthStatus };

