import fs from "node:fs";
import { NextResponse } from "next/server";
import {
  createLifeAdminService,
  getSystemSettings,
  prisma,
  resolveCaptureUploadFilePath,
  resolveEffectiveUploadsPath,
} from "@uwe/database/server";
import { captureIdParamSchema, parseParams, requireStudioApiAuth } from "@uwe/security";

interface RouteContext {
  params: Promise<{ captureId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const parsed = await parseParams(context.params, captureIdParamSchema);
  if (!parsed.success) return parsed.response;

  const { captureId } = parsed.data;
  const capture = await createLifeAdminService(prisma).getCapture(captureId);

  if (!capture?.storageKey) {
    return NextResponse.json({ error: "Capture file not found" }, { status: 404 });
  }

  const settings = await getSystemSettings(prisma);
  const uploadsRoot = resolveEffectiveUploadsPath(settings);

  let filePath: string;
  try {
    filePath = resolveCaptureUploadFilePath(capture.storageKey, uploadsRoot);
  } catch {
    return NextResponse.json({ error: "Invalid storage key" }, { status: 400 });
  }

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File missing on disk" }, { status: 404 });
  }

  const metadata = capture.metadata as Record<string, unknown> | null;
  const mimeType =
    (typeof metadata?.mimeType === "string" ? metadata.mimeType : null) ?? "application/octet-stream";
  const originalFilename =
    typeof metadata?.originalFilename === "string" ? metadata.originalFilename : capture.title;
  const data = fs.readFileSync(filePath);

  return new NextResponse(data, {
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(data.length),
      "Content-Disposition": `inline; filename="${encodeURIComponent(originalFilename)}"`,
    },
  });
}
