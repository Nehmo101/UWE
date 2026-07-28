import fs from "node:fs";
import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import {
  ensureUploadDirectory,
  inferAssetTypeFromMime,
  inferMimeTypeFromFilename,
  resolveAssetFilePath,
  resolveUploadPolicyConfig,
  validateUploadInput,
  UploadValidationError,
  type DetectedFileKind,
  type UploadPolicyConfig,
} from "@uwe/assets";
import {
  getAppRepository,
  getSystemSettings,
  logAuditEvent,
  NON_SANDBOX_WORLD_WHERE,
  prisma,
  resolveEffectiveUploadsPath,
} from "@uwe/database/server";
import { getUweEnvOrNull } from "@uwe/env";
import { guardStudioApiMutation } from "@/src/lib/studio-admin-auth";

const IMAGE_KINDS: ReadonlySet<DetectedFileKind> = new Set(["png", "jpeg", "gif", "webp"]);

function imageOnlyUploadPolicy(): UploadPolicyConfig {
  return {
    ...resolveUploadPolicyConfig(),
    allowedKinds: IMAGE_KINDS,
    allowDocuments: false,
  };
}

export async function POST(request: Request) {
  const authError = await guardStudioApiMutation(request, { rateLimit: "upload" });
  if (authError) return authError;

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return jsonError("Bild erforderlich.", 400);
  }

  const maxUploadBytes = getUweEnvOrNull()?.maxUploadBytes ?? 25 * 1024 * 1024;
  if (file.size > maxUploadBytes) {
    return NextResponse.json(
      {
        error: `Datei überschreitet maximale Größe (${Math.floor(maxUploadBytes / (1024 * 1024))} MB).`,
      },
      { status: 413 },
    );
  }

  const world = await prisma.world.findFirst({
    where: NON_SANDBOX_WORLD_WHERE,
    orderBy: { name: "asc" },
  });

  if (!world) {
    return NextResponse.json(
      { error: "Keine Welt für Screenshot-Speicherung vorhanden." },
      { status: 503 },
    );
  }

  const mimeType = file.type || inferMimeTypeFromFilename(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  const title = file.name || "Bug-Screenshot";

  let validated;
  try {
    validated = validateUploadInput({
      buffer,
      originalFilename: file.name,
      declaredMimeType: mimeType,
      worldId: world.id,
      config: imageOnlyUploadPolicy(),
    });
  } catch (error) {
    if (error instanceof UploadValidationError) {
      return jsonError(error.message, 400);
    }
    throw error;
  }

  if (!IMAGE_KINDS.has(validated.kind)) {
    return NextResponse.json(
      { error: "Nur Bilder (PNG, JPEG, GIF, WebP) erlaubt." },
      { status: 400 },
    );
  }

  const repo = getAppRepository();
  const settings = await getSystemSettings();
  const uploadsRoot = resolveEffectiveUploadsPath(settings);
  ensureUploadDirectory(world.id, undefined, uploadsRoot);
  const filePath = resolveAssetFilePath(validated.storageKey, undefined, uploadsRoot);
  await fs.promises.writeFile(filePath, buffer);

  const asset = await repo.createAsset({
    worldId: world.id,
    title,
    type: inferAssetTypeFromMime(validated.mimeType),
    storageKey: validated.storageKey,
    mimeType: validated.mimeType,
    size: buffer.length,
    metadata: { source: "bug_center" },
  });

  await logAuditEvent(prisma, {
    action: "upload_created",
    targetType: "asset",
    targetId: asset.id,
    worldId: world.id,
    metadata: { title: asset.title, source: "bug_screenshot" },
  });

  return NextResponse.json({ assetId: asset.id });
}
