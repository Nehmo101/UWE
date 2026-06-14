import {
  getAdminStatus,
  type AdminStatus,
} from "@uwe/database/server";
import { checkRtxHealth, type RtxHealthStatus } from "@uwe/ai-brain/router";
import { getInferenceStatus, type InferenceStatus } from "@uwe/ai-brain/inference";
import type { PrismaClient } from "@uwe/database/server";

export interface AdminDashboardStatus extends AdminStatus {
  inference: InferenceStatus;
  rtx: RtxHealthStatus;
}

export async function getAdminDashboardStatus(
  db: PrismaClient,
  options: { rateLimiterMode?: string; useMockInference?: boolean } = {},
): Promise<AdminDashboardStatus> {
  const [admin, inference, rtx] = await Promise.all([
    getAdminStatus(db, { rateLimiterMode: options.rateLimiterMode }),
    getInferenceStatus({ useMock: options.useMockInference }),
    checkRtxHealth({ useMock: options.useMockInference }),
  ]);

  const inferenceBlocksOk = !inference.enabled || rtx.ready || inference.online;
  const securityBlocksOk =
    admin.studioSecurity.severity !== "critical" && admin.rtxExposure.severity !== "critical";
  const ok = admin.ok && inferenceBlocksOk && securityBlocksOk;

  return {
    ...admin,
    ok,
    inference,
    rtx,
  };
}

export type { InferenceStatus, RtxHealthStatus };
