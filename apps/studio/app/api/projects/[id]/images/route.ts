import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import {
  createLifeAdminService,
  getSystemSettings,
  logAuditEvent,
  prisma,
  resolveEffectiveUploadsPath,
  saveCaptureUploadFile,
} from "@uwe/database/server";
import { getUweEnvOrNull } from "@uwe/env";
import { idSchema, parseParams } from "@uwe/security";
import { z } from "zod";
import { guardStudioApiMutation } from "@/src/lib/studio-admin-auth";

const paramsSchema = z.object({ id: idSchema });

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const authError = await guardStudioApiMutation(request, { rateLimit: "upload" });
  if (authError) return authError;

  const parsed = await parseParams(context.params, paramsSchema);
  if (!parsed.success) return parsed.response;
  const projectId = parsed.data.id;

  const service = createLifeAdminService(prisma);
  const project = await service.getPersonalProject(projectId);
  if (!project) {
    return jsonError("Projekt nicht gefunden.", 404);
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return jsonError("Datei erforderlich.", 400);
  }

  const maxUploadBytes = getUweEnvOrNull()?.maxUploadBytes ?? 50 * 1024 * 1024;
  if (file.size > maxUploadBytes) {
    return NextResponse.json(
      {
        error: `Datei überschreitet die maximale Upload-Größe (${Math.floor(maxUploadBytes / (1024 * 1024))} MB).`,
      },
      { status: 413 },
    );
  }

  const caption = String(formData.get("caption") ?? "").trim();
  const buffer = Buffer.from(await file.arrayBuffer());
  const settings = await getSystemSettings();
  const uploadsRoot = resolveEffectiveUploadsPath(settings);

  let validated;
  try {
    validated = saveCaptureUploadFile(buffer, {
      originalFilename: file.name,
      declaredMimeType: file.type,
      uploadsRoot,
      imagesOnly: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload fehlgeschlagen.";
    return jsonError(message, 400);
  }

  const image = await service.addProjectImage(projectId, {
    storageKey: validated.storageKey,
    originalFilename: file.name,
    mimeType: validated.mimeType,
    caption,
  });

  await logAuditEvent(prisma, {
    action: "upload_created",
    targetType: "asset",
    targetId: image.id,
    metadata: { projectId, originalFilename: file.name, source: "project_media" },
  });

  return NextResponse.json({
    id: image.id,
    url: `/api/projects/images/${image.id}`,
    caption: image.caption,
    originalFilename: image.originalFilename,
  });
}
