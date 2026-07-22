import fs from "node:fs";
import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import {
import { brainPrisma } from "@uwe/database/brain-client";
  createLifeAdminService,
  getSystemSettings,
  logAuditEvent,
  prisma,
  resolveCaptureUploadFilePath,
  resolveEffectiveUploadsPath,
} from "@uwe/database/server";
import { idSchema, parseParams } from "@uwe/security";
import { z } from "zod";
import {
  guardStudioApiMutation,
  guardStudioApiRequest,
} from "@/src/lib/studio-admin-auth";

const paramsSchema = z.object({ imageId: idSchema });

interface RouteContext {
  params: Promise<{ imageId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const parsed = await parseParams(context.params, paramsSchema);
  if (!parsed.success) return parsed.response;

  const image = await createLifeAdminService(brainPrisma, prisma).getProjectImage(parsed.data.imageId);
  if (!image) {
    return jsonError("Bild nicht gefunden.", 404);
  }

  const settings = await getSystemSettings(prisma);
  const uploadsRoot = resolveEffectiveUploadsPath(settings);

  let filePath: string;
  try {
    filePath = resolveCaptureUploadFilePath(image.storageKey, uploadsRoot);
  } catch {
    return jsonError("Ungültiger Speicherpfad", 400);
  }

  if (!fs.existsSync(filePath)) {
    return jsonError("Datei fehlt", 404);
  }

  const data = await fs.promises.readFile(filePath);
  return new NextResponse(data, {
    headers: {
      "Content-Type": image.mimeType || "application/octet-stream",
      "Content-Length": String(data.length),
      "Content-Disposition": `inline; filename="${encodeURIComponent(image.originalFilename || image.id)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  const authError = await guardStudioApiMutation(request);
  if (authError) return authError;

  const parsed = await parseParams(context.params, paramsSchema);
  if (!parsed.success) return parsed.response;

  const service = createLifeAdminService(brainPrisma, prisma);
  const image = await service.getProjectImage(parsed.data.imageId);
  if (!image) {
    return jsonError("Bild nicht gefunden.", 404);
  }

  await service.deleteProjectImage(image.id);

  const settings = await getSystemSettings(prisma);
  const uploadsRoot = resolveEffectiveUploadsPath(settings);
  try {
    const filePath = resolveCaptureUploadFilePath(image.storageKey, uploadsRoot);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // File already gone or path invalid — record removal is what matters.
  }

  await logAuditEvent(prisma, {
    action: "upload_deleted",
    targetType: "asset",
    targetId: image.id,
    metadata: { projectId: image.projectId, source: "project_media" },
  });

  return NextResponse.json({ ok: true });
}
