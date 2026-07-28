import fs from "node:fs";
import { NextResponse } from "next/server";
import { brainPrisma } from "@uwe/database/brain-client";
import {
  ensureUploadDirectory,
  resolveAssetFilePath,
  validateUploadInput,
  UploadValidationError,
} from "@uwe/assets";
import {
  getSystemSettings,
  prisma,
  resolveEffectiveUploadsPath,
} from "@uwe/database/server";
import { createScanInboxService, type ScanPrivacyLevel } from "@uwe/scan-inbox";
import { requireFamilyApiAuth } from "@/src/lib/family-api-auth";

/**
 * Scan hochladen. Lag in Studio; der Scan-Eingang ist Family (Abschnitt G).
 *
 * Der Upload ist eine Route und keine Server-Action, weil das Formular eine
 * Datei schickt und der Fortschritt im Browser sichtbar bleiben soll.
 */

/** Ablage-Namensraum für welt-unabhängige Scan-Uploads. */
const SCAN_UPLOAD_NAMESPACE = "_scan";

export async function POST(request: Request) {
  const authError = await requireFamilyApiAuth();
  if (authError) return authError;

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Datei erforderlich." }, { status: 400 });
  }

  const title = String(formData.get("title") ?? "").trim() || file.name || "Scan";
  const privacyRaw = String(formData.get("privacyLevel") ?? "private");
  const privacyLevel: ScanPrivacyLevel = privacyRaw === "dnd" ? "dnd" : "private";

  const buffer = Buffer.from(await file.arrayBuffer());
  const settings = await getSystemSettings(prisma);
  const uploadsRoot = resolveEffectiveUploadsPath(settings);

  let storageKey: string;
  let mimeType: string;
  try {
    const validated = validateUploadInput({
      buffer,
      originalFilename: file.name,
      declaredMimeType: file.type,
      worldId: SCAN_UPLOAD_NAMESPACE,
    });
    storageKey = validated.storageKey;
    mimeType = validated.mimeType;
  } catch (error) {
    if (error instanceof UploadValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  ensureUploadDirectory(SCAN_UPLOAD_NAMESPACE, undefined, uploadsRoot);
  const filePath = resolveAssetFilePath(storageKey, undefined, uploadsRoot);
  await fs.promises.writeFile(filePath, buffer);

  const scan = await createScanInboxService(brainPrisma, prisma).create({
    storageKey,
    mimeType,
    fileSize: buffer.length,
    title,
    privacyLevel,
  });

  return NextResponse.json({ id: scan.id, title: scan.title });
}
