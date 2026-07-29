import { NextResponse } from "next/server";

import { createImportJobService, prisma } from "@uwe/database/server";
import { jsonError } from "@/src/lib/api-response";
import { guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { readCampaignImportFigure } from "@/src/lib/campaign-pdf-storage";
import { readCampaignFigures } from "@/src/lib/campaign-figure-assets";

/**
 * Liefert eine von der OCR zugeschnittene Abbildung für die Import-Vorschau
 * aus. Zu diesem Zeitpunkt gibt es noch kein Asset — die Zuschnitte liegen als
 * Zwischenmaterial neben der PDF und werden erst beim Execute übernommen.
 *
 * Zwei Prüfungen, damit die Route kein beliebiger Datei-Leser wird:
 * der Job muss ein PDF-zu-Kampagne-Job sein, und der angefragte Index muss in
 * dessen Vorschau-Payload stehen. `assertSafeJobId` im Storage-Helper deckt
 * Pfad-Traversal ab.
 */
export async function GET(request: Request) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const jobId = (url.searchParams.get("jobId") ?? "").trim();
  const rawIndex = (url.searchParams.get("index") ?? "").trim();
  const index = Number(rawIndex);

  if (!jobId || !rawIndex || !Number.isInteger(index) || index < 0) {
    return jsonError("Parameter 'jobId' und 'index' erforderlich.");
  }

  const job = await createImportJobService(prisma).getJob(jobId);
  if (!job || job.sourceType !== "pdf" || job.targetType !== "campaign") {
    return jsonError("Import-Job nicht gefunden.", 404);
  }

  // Nur Indizes, die der Job selbst gemeldet hat — sonst wäre jede Zahl ein
  // Leseversuch auf fremde Dateien im Zwischenablage-Verzeichnis.
  const known = readCampaignFigures(job.previewPayload);
  if (!known.some((figure) => figure.index === index)) {
    return jsonError("Abbildung nicht gefunden.", 404);
  }

  const buffer = await readCampaignImportFigure(jobId, index);
  if (!buffer?.length) {
    return jsonError("Abbildung nicht gefunden.", 404);
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(buffer.length),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      // Zwischenmaterial: nie cachen, es verschwindet nach dem Execute.
      "Cache-Control": "no-store",
    },
  });
}
