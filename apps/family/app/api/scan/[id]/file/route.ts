import fs from "node:fs";
import { NextResponse } from "next/server";
import { requireFamilyApiAuth } from "@/src/lib/family-api-auth";
import { resolveScanFile } from "@/src/lib/scan-file";

/**
 * Liefert die Originaldatei eines Scans aus (Bild oder PDF), damit die
 * Detailseite sie einbetten kann.
 *
 * Lag in Studio. Der Scan-Eingang ist Family (Abschnitt G), also liegt die
 * Route hier — hinter demselben Häkchen-Guard wie jede andere Family-Route.
 */

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const authError = await requireFamilyApiAuth();
  if (authError) return authError;

  const { id } = await context.params;
  const data = await resolveScanFile(id);
  if (!data || !fs.existsSync(data.filePath)) {
    return NextResponse.json({ error: "Scan-Datei nicht gefunden" }, { status: 404 });
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
