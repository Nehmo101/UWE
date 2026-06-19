import fs from "node:fs";
import { NextResponse } from "next/server";
import { resolveAssetFilePath } from "@uwe/assets";
import { createLifeAdminService, prisma } from "@uwe/database/server";
import { captureIdParamSchema, parseParams, requireStudioApiAuth } from "@uwe/security";

interface RouteContext {
  params: Promise<{ captureId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const parsed = await parseParams(context.params, captureIdParamSchema);
  if (!parsed.success) return parsed.response;

  const capture = await createLifeAdminService(prisma).getCapture(parsed.data.captureId);
  if (!capture?.storageKey) {
    return NextResponse.json({ error: "Kein Anhang" }, { status: 404 });
  }

  let filePath: string;
  try {
    filePath = resolveAssetFilePath(capture.storageKey);
  } catch {
    return NextResponse.json({ error: "Ungültiger Speicherpfad" }, { status: 400 });
  }

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Datei fehlt" }, { status: 404 });
  }

  const metadata =
    capture.metadata && typeof capture.metadata === "object" && !Array.isArray(capture.metadata)
      ? (capture.metadata as Record<string, unknown>)
      : {};
  const mimeType =
    typeof metadata.mimeType === "string" ? metadata.mimeType : "application/octet-stream";

  const data = fs.readFileSync(filePath);
  return new NextResponse(data, {
    headers: {
      "Content-Type": mimeType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
