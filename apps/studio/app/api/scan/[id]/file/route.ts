import { guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import fs from "node:fs";
import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import { resolveScanFile } from "@/app/scan-inbox/scan-file";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const { id } = await context.params;
  const data = await resolveScanFile(id);
  if (!data || !fs.existsSync(data.filePath)) {
    return jsonError("Scan-Datei nicht gefunden", 404);
  }

  const bytes = await fs.promises.readFile(data.filePath);
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": data.mimeType || "application/octet-stream",
      "Content-Length": String(bytes.length),
      "Content-Disposition": `inline; filename="${encodeURIComponent(data.title || "scan")}"`,
    },
  });
}
