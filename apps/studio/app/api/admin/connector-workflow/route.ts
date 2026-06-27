import { NextResponse } from "next/server";
import { z } from "zod";

import {
  CONNECTOR_WORKFLOW_SLOTS,
  ConnectorWorkflowValidationError,
  createConnectorWorkflowService,
  prisma,
} from "@uwe/database/server";
import { parseBody, requireAdminApiAuth } from "@uwe/security";

import { resolveStudioApiAuthContext } from "@/src/lib/studio-admin-auth";

const patchSchema = z.object({
  slot: z.enum(CONNECTOR_WORKFLOW_SLOTS),
  // null/empty clears the default for the slot.
  connectorId: z.string().min(1).max(64).nullable().optional(),
  modelId: z.string().min(1).max(256).nullable().optional(),
});

export async function GET(request: Request) {
  const context = await resolveStudioApiAuthContext(request);
  const authError = requireAdminApiAuth(request, context, {
    rateLimit: "setup",
    requiredScopes: ["admin_read"],
  });
  if (authError) return authError;

  const service = createConnectorWorkflowService(prisma);
  const [pickerModels, defaults] = await Promise.all([
    service.listPickerModels(),
    service.listDefaults(),
  ]);

  return NextResponse.json({ slots: CONNECTOR_WORKFLOW_SLOTS, pickerModels, defaults });
}

export async function PATCH(request: Request) {
  const context = await resolveStudioApiAuthContext(request);
  const authError = requireAdminApiAuth(request, context, {
    rateLimit: "setup",
    requiredScopes: ["admin_write"],
  });
  if (authError) return authError;

  const parsed = await parseBody(request, patchSchema);
  if (!parsed.success) return parsed.response;

  const service = createConnectorWorkflowService(prisma);
  const { slot, connectorId, modelId } = parsed.data;

  if (!connectorId || !modelId) {
    await service.clearDefault(slot);
    return NextResponse.json({ ok: true, default: null });
  }

  try {
    const saved = await service.setDefault(slot, connectorId, modelId);
    return NextResponse.json({ ok: true, default: saved });
  } catch (error) {
    if (error instanceof ConnectorWorkflowValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
