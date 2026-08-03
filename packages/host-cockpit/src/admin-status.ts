import type { PrismaClient } from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import {
  getAdminStatus,
  type AdminStatus,
} from "@uwe/database/server";
import { validateUweEnvironment, type EnvValidationIssue } from "@uwe/auth";
import { checkEngineReadiness, type EngineReadinessStatus } from "@uwe/ai-brain/router";
import { getInferenceStatus, type InferenceStatus } from "@uwe/ai-brain/inference";

export interface AdminDashboardStatus extends AdminStatus {
  inference: InferenceStatus;
  engine: EngineReadinessStatus;
  envValidation: EnvValidationIssue[];
}

export async function getAdminDashboardStatus(
  db: PrismaClient,
  options: { rateLimiterMode?: string; useMockInference?: boolean } = {},
): Promise<AdminDashboardStatus> {
  const [admin, inference, engine] = await Promise.all([
    getAdminStatus(db, brainPrisma, { rateLimiterMode: options.rateLimiterMode }),
    getInferenceStatus({ useMock: options.useMockInference }),
    checkEngineReadiness({ useMock: options.useMockInference, prisma: db }),
  ]);

  const envValidation = validateUweEnvironment();

  const inferenceBlocksOk = !inference.enabled || engine.ready || inference.online;
  const securityBlocksOk =
    admin.studioSecurity.severity !== "critical" &&
    admin.engineExposure.severity !== "critical";
  const ok = admin.ok && inferenceBlocksOk && securityBlocksOk;

  return {
    ...admin,
    ok,
    inference,
    engine,
    envValidation,
  };
}

export type { InferenceStatus, EngineReadinessStatus as EngineHealthStatus };

