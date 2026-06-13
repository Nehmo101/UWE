import {
  getAdminStatus,
  type AdminStatus,
} from "@uwe/database/server";
import { getInferenceStatus, type InferenceStatus } from "@uwe/ai-brain/inference";
import type { PrismaClient } from "@uwe/database/server";

export interface AdminDashboardStatus extends AdminStatus {
  inference: InferenceStatus;
}

export async function getAdminDashboardStatus(
  db: PrismaClient,
  options: { rateLimiterMode?: string; useMockInference?: boolean } = {},
): Promise<AdminDashboardStatus> {
  const [admin, inference] = await Promise.all([
    getAdminStatus(db, { rateLimiterMode: options.rateLimiterMode }),
    getInferenceStatus({ useMock: options.useMockInference }),
  ]);

  const inferenceBlocksOk = !inference.enabled || inference.online;
  const ok = admin.ok && inferenceBlocksOk;

  return {
    ...admin,
    ok,
    inference,
  };
}

export type { InferenceStatus };
