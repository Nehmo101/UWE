import fs from "node:fs";
import { NextResponse } from "next/server";
import { requireStudioApiAuth } from "@uwe/security";
import { resolveScanFile } from "@/app/scan-inbox/scan-file";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const { id } = await context.params;
  const data = await resolveScanFile(id);
  if (!data || !fs.existsSync(data.filePath)) {
    return NextResponse.json({ error: "Scan-Datei nicht gefunden" }, { status: 404 });
  }

  const bytes = fs.readFileSync(data.filePath);
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": data.mimeType || "application/octet-stream",
      "Content-Length": String(bytes.length),
      "Content-Disposition": `inline; filename="${encodeURIComponent(data.title || "scan")}"`,
    },
  });
}
