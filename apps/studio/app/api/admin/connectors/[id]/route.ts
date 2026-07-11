import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import { z } from "zod";

import { getDirectConnectorRegistry } from "@uwe/connector/direct";
import { createConnectorService, prisma } from "@uwe/database/server";
import { idSchema, parseBody, parseParams, requireAdminApiAuth } from "@uwe/security";

import { resolveStudioApiAuthContext } from "@/src/lib/studio-admin-auth";

const paramSchema = z.object({ id: idSchema });
const patchSchema = z.object({
  action: z.enum(["enable", "disable", "rotate-token", "set-allowed-capabilities"]),
  /** null = unrestricted; [] = deny all reported capabilities. */
  allowedCapabilities: z.array(z.string()).nullable().optional(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  const authContext = await resolveStudioApiAuthContext(request);
  const authError = requireAdminApiAuth(request, authContext, {
    rateLimit: "setup",
    requiredScopes: ["admin_write"],
  });
  if (authError) return authError;

  const parsedParams = await parseParams(context.params, paramSchema);
  if (!parsedParams.success) return parsedParams.response;

  const parsed = await parseBody(request, patchSchema);
  if (!parsed.success) return parsed.response;

  const service = createConnectorService(prisma);
  const registry = getDirectConnectorRegistry();
  const existing = await service.getConnector(parsedParams.data.id);
  if (!existing) {
    return jsonError("Connector nicht gefunden.", 404);
  }

  if (parsed.data.action === "rotate-token") {
    const { token } = await service.rotateToken(existing.id);
    registry.disconnect(existing.id, "Connector token was rotated.");
    return NextResponse.json({
      token,
      warning:
        "Neues Connector-Token — das alte ist sofort ungültig. Trage es als UWE_CONNECTOR_TOKEN ein.",
    });
  }

  if (parsed.data.action === "set-allowed-capabilities") {
    if (parsed.data.allowedCapabilities === undefined) {
      return NextResponse.json(
        { error: "allowedCapabilities fehlt (null = uneingeschränkt, [] = alles blockieren)." },
        { status: 400 },
      );
    }
    const connector = await service.setAllowedCapabilities(
      existing.id,
      parsed.data.allowedCapabilities,
    );
    if (!connector) {
      return NextResponse.json({ error: "Connector nicht gefunden." }, { status: 404 });
    }
    registry.disconnect(existing.id, "Connector capability policy changed.");
    return NextResponse.json({ connector });
  }

  const disabled = parsed.data.action === "disable";
  await service.setDisabled(existing.id, disabled);
  if (disabled) {
    registry.disconnect(existing.id, "Connector was disabled.");
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, context: RouteContext) {
  const authContext = await resolveStudioApiAuthContext(request);
  const authError = requireAdminApiAuth(request, authContext, {
    rateLimit: "setup",
    requiredScopes: ["admin_write"],
  });
  if (authError) return authError;

  const parsedParams = await parseParams(context.params, paramSchema);
  if (!parsedParams.success) return parsedParams.response;

  const service = createConnectorService(prisma);
  const existing = await service.getConnector(parsedParams.data.id);
  if (!existing) {
    return jsonError("Connector nicht gefunden.", 404);
  }

  getDirectConnectorRegistry().disconnect(existing.id, "Connector was deleted.");
  await service.deleteConnector(existing.id);
  return NextResponse.json({ ok: true });
}
