import { NextResponse } from "next/server";
import { MAX_CAMPAIGN_PDF_BYTES } from "@uwe/pdf-campaign-import";
import { createImportJobService, prisma } from "@uwe/database/server";
import { jsonError } from "@/src/lib/api-response";
import { guardStudioApiMutation } from "@/src/lib/studio-admin-auth";
import { writeCampaignImportPdf } from "@/src/lib/campaign-pdf-storage";

/**
 * Nimmt die Kampagnen-PDF (bis 300 MB) als multipart/form-data entgegen und
 * legt sie auf dem Host ab. Server Actions sind auf 15 MB Base64 begrenzt —
 * große Abenteuerbände laufen deshalb über diese Route; die Analyse-Action
 * liest anschließend nur noch von der Festplatte.
 */
export async function POST(request: Request) {
  const authError = await guardStudioApiMutation(request, { rateLimit: "upload" });
  if (authError) return authError;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("Ungültiger Upload (multipart/form-data erwartet).");
  }

  const jobId = String(form.get("jobId") || "").trim();
  const file = form.get("file");
  if (!jobId) {
    return jsonError("Feld 'jobId' fehlt.");
  }
  if (!(file instanceof File) || file.size === 0) {
    return jsonError("PDF-Datei erforderlich.");
  }
  if (file.size > MAX_CAMPAIGN_PDF_BYTES) {
    return jsonError(
      `PDF-Datei ist zu groß (max. ${Math.floor(MAX_CAMPAIGN_PDF_BYTES / (1024 * 1024))} MB).`,
      413,
    );
  }

  const importJobs = createImportJobService(prisma);
  const job = await importJobs.getJob(jobId);
  if (!job) {
    return jsonError("Import-Job nicht gefunden.", 404);
  }
  if (job.sourceType !== "pdf" || job.targetType !== "campaign") {
    return jsonError("Dieser Import-Job ist kein PDF-zu-Kampagne-Import.");
  }
  if (job.status === "executing" || job.status === "completed" || job.status === "rolled_back") {
    return jsonError("Für diesen Job kann keine PDF mehr hochgeladen werden.", 409);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!buffer.subarray(0, 4).toString("utf8").startsWith("%PDF")) {
    return jsonError("Datei ist keine gültige PDF.");
  }

  await writeCampaignImportPdf(jobId, buffer);

  const existingMetadata =
    typeof job.metadata === "object" && job.metadata !== null && !Array.isArray(job.metadata)
      ? (job.metadata as Record<string, unknown>)
      : {};
  await importJobs.updateJob(jobId, {
    status: "pending",
    // Neue PDF ⇒ alte Vorschau/Analyse ist hinfällig. `null` würde die Spalte
    // nicht ändern (toPrismaJsonValue), daher ein expliziter Reset-Payload.
    previewPayload: { kind: "campaign_pdf_uploaded" },
    errorMessage: null,
    metadata: {
      ...existingMetadata,
      pdfFileName: file.name || "import.pdf",
      pdfSize: buffer.length,
    },
  });

  return NextResponse.json({
    ok: true,
    fileName: file.name || "import.pdf",
    size: buffer.length,
  });
}
