import { NextResponse } from "next/server";
import { inferAssetTypeFromMime } from "@uwe/assets";
import {
  getAppRepository,
  getSystemSettings,
  logAuditEvent,
  prisma,
  resolveEffectiveUploadsPath,
  saveCaptureUploadFile,
} from "@uwe/database/server";
import { getUweEnvOrNull } from "@uwe/env";
import { guardStudioMutation } from "@uwe/security";

export async function POST(request: Request) {
  const authError = guardStudioMutation(request, { rateLimit: "upload" });
  if (authError) return authError;

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Datei erforderlich." }, { status: 400 });
  }

  const maxUploadBytes = getUweEnvOrNull()?.maxUploadBytes ?? 50 * 1024 * 1024;
  if (file.size > maxUploadBytes) {
    return NextResponse.json(
      {
        error: `Datei überschreitet die maximale Upload-Größe (${Math.floor(maxUploadBytes / (1024 * 1024))} MB).`,
      },
      { status: 413 },
    );
  }

  const title = String(formData.get("title") ?? "").trim() || file.name || "Miniatur-Foto";
  const worldSlug = String(formData.get("worldSlug") ?? "").trim();

  const buffer = Buffer.from(await file.arrayBuffer());
  const settings = await getSystemSettings();
  const uploadsRoot = resolveEffectiveUploadsPath(settings);

  let validated;
  try {
    validated = saveCaptureUploadFile(buffer, {
      originalFilename: file.name,
      declaredMimeType: file.type,
      uploadsRoot,
      imagesOnly: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload fehlgeschlagen.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const repo = getAppRepository();
  const world = worldSlug
    ? await repo.getWorldBySlug(worldSlug)
    : (await repo.listWorlds())[0] ?? null;

  if (!world) {
    return NextResponse.json(
      { error: "Keine Welt vorhanden — bitte zuerst eine Welt anlegen." },
      { status: 400 },
    );
  }

  const asset = await repo.createAsset({
    worldId: world.id,
    title,
    type: inferAssetTypeFromMime(validated.mimeType),
    storageKey: validated.storageKey,
    mimeType: validated.mimeType,
    size: buffer.length,
    visibility: "dm_only",
    metadata: { source: "miniature_photo" },
  });

  await logAuditEvent(prisma, {
    action: "upload_created",
    targetType: "asset",
    targetId: asset.id,
    worldId: world.id,
    metadata: { title: asset.title, source: "miniature_upload" },
  });

  return NextResponse.json({
    assetId: asset.id,
    storageKey: validated.storageKey,
    title: asset.title,
  });
}
