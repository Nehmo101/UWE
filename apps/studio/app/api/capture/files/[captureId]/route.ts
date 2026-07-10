import { guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import fs from "node:fs";
import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import {
  createLifeAdminService,
  getSystemSettings,
  prisma,
  resolveCaptureUploadFilePath,
  resolveEffectiveUploadsPath,
} from "@uwe/database/server";
import { captureIdParamSchema, parseParams } from "@uwe/security";

interface RouteContext {
  params: Promise<{ captureId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const parsed = await parseParams(context.params, captureIdParamSchema);
  if (!parsed.success) return parsed.response;

  const capture = await createLifeAdminService(prisma).getCapture(parsed.data.captureId);
  if (!capture?.storageKey) {
    return jsonError("Kein Anhang", 404);
  }

  const settings = await getSystemSettings(prisma);
  const uploadsRoot = resolveEffectiveUploadsPath(settings);

  let filePath: string;
  try {
    filePath = resolveCaptureUploadFilePath(capture.storageKey, uploadsRoot);
  } catch {
    return jsonError("Ungültiger Speicherpfad", 400);
  }

  if (!fs.existsSync(filePath)) {
    return jsonError("Datei fehlt", 404);
  }

  const metadata =
    capture.metadata && typeof capture.metadata === "object" && !Array.isArray(capture.metadata)
      ? (capture.metadata as Record<string, unknown>)
      : {};
  const mimeType =
    typeof metadata.mimeType === "string" ? metadata.mimeType : "application/octet-stream";
  const originalFilename =
    typeof metadata.originalFilename === "string" ? metadata.originalFilename : capture.title;
  const data = await fs.promises.readFile(filePath);

  return new NextResponse(data, {
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(data.length),
      "Content-Disposition": `inline; filename="${encodeURIComponent(originalFilename)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
