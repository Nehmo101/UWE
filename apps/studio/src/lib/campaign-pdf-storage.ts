import fs from "node:fs";
import path from "node:path";
import { getSystemSettings, resolveEffectiveUploadsPath } from "@uwe/database/server";

/**
 * Temporäre Ablage für Kampagnen-PDF-Uploads (bis zu 300 MB): Die Datei wird
 * über die Upload-API-Route hierher geschrieben, von der Analyse-Action wieder
 * gelesen und nach erfolgreicher Vorschau gelöscht. Kein Asset-Eintrag — die
 * PDF ist nur Zwischenmaterial für die Textextraktion.
 */
const CAMPAIGN_IMPORT_TMP_DIR = "import-tmp";

function assertSafeJobId(jobId: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(jobId)) {
    throw new Error("Ungültige Import-Job-ID.");
  }
  return jobId;
}

async function resolveCampaignImportDir(): Promise<string> {
  const settings = await getSystemSettings();
  return path.join(resolveEffectiveUploadsPath(settings), CAMPAIGN_IMPORT_TMP_DIR);
}

export async function resolveCampaignImportPdfPath(jobId: string): Promise<string> {
  return path.join(await resolveCampaignImportDir(), `${assertSafeJobId(jobId)}.pdf`);
}

export async function writeCampaignImportPdf(jobId: string, buffer: Buffer): Promise<string> {
  const dir = await resolveCampaignImportDir();
  await fs.promises.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${assertSafeJobId(jobId)}.pdf`);
  await fs.promises.writeFile(filePath, buffer);
  return filePath;
}

export async function readCampaignImportPdf(jobId: string): Promise<Buffer | null> {
  try {
    return await fs.promises.readFile(await resolveCampaignImportPdfPath(jobId));
  } catch {
    return null;
  }
}

export async function hasCampaignImportPdf(jobId: string): Promise<boolean> {
  try {
    await fs.promises.access(await resolveCampaignImportPdfPath(jobId));
    return true;
  } catch {
    return false;
  }
}

export async function deleteCampaignImportPdf(jobId: string): Promise<void> {
  try {
    await fs.promises.unlink(await resolveCampaignImportPdfPath(jobId));
  } catch {
    // Datei existiert nicht mehr — nichts zu tun.
  }
}

/**
 * Von der OCR zugeschnittene Abbildungen liegen bis zum Execute daneben: Die
 * Vorschau-Payload ist JSON in der DB und kann keine Bilddaten tragen, und erst
 * beim Execute ist klar, welche Entitäten der Nutzer überhaupt übernimmt.
 */
function figureFileName(jobId: string, index: number): string {
  return `${assertSafeJobId(jobId)}-fig-${index}.jpg`;
}

export async function writeCampaignImportFigure(
  jobId: string,
  index: number,
  buffer: Buffer,
): Promise<void> {
  const dir = await resolveCampaignImportDir();
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(path.join(dir, figureFileName(jobId, index)), buffer);
}

export async function readCampaignImportFigure(
  jobId: string,
  index: number,
): Promise<Buffer | null> {
  try {
    const dir = await resolveCampaignImportDir();
    return await fs.promises.readFile(path.join(dir, figureFileName(jobId, index)));
  } catch {
    return null;
  }
}

/** Räumt alle Zuschnitte eines Jobs ab — nach Execute oder bei Abbruch. */
export async function deleteCampaignImportFigures(jobId: string): Promise<void> {
  const safeJobId = assertSafeJobId(jobId);
  try {
    const dir = await resolveCampaignImportDir();
    const entries = await fs.promises.readdir(dir);
    await Promise.all(
      entries
        .filter((entry) => entry.startsWith(`${safeJobId}-fig-`))
        .map((entry) => fs.promises.unlink(path.join(dir, entry)).catch(() => undefined)),
    );
  } catch {
    // Verzeichnis fehlt — nichts zu tun.
  }
}
