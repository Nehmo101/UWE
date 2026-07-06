"use server";

import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import type { MiniatureCollectionStatus } from "@uwe/database/server";
import {
  createMiniatureCollectionService,
  MiniatureCollectionStatusEnum,
  prisma,
} from "@uwe/database/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function miniatureService() {
  return createMiniatureCollectionService(prisma);
}

function parseOptionalInt(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseComparePhotoAssetIds(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function readStatus(raw: FormDataEntryValue | null): MiniatureCollectionStatus {
  const value = String(raw ?? "purchased").trim();
  if (Object.values(MiniatureCollectionStatusEnum).includes(value as MiniatureCollectionStatus)) {
    return value as MiniatureCollectionStatus;
  }
  return "purchased";
}

function revalidateMiniaturePaths() {
  revalidatePath("/miniatures");
  revalidatePath("/workshop");
  revalidatePath("/today");
}

function readMiniatureFields(formData: FormData) {
  const quantity = parseOptionalInt(formData.get("quantity"));
  return {
    name: String(formData.get("name") || "").trim(),
    manufacturer: String(formData.get("manufacturer") || "").trim() || null,
    gameSystem: String(formData.get("gameSystem") || "").trim() || null,
    faction: String(formData.get("faction") || "").trim() || null,
    quantity: quantity ?? undefined,
    status: readStatus(formData.get("status")),
    notes: String(formData.get("notes") || ""),
    referenceImageAssetId: String(formData.get("referenceImageAssetId") || "").trim() || null,
    comparePhotoAssetIds: parseComparePhotoAssetIds(String(formData.get("comparePhotoAssetIds") || "")),
    workshopProjectId: String(formData.get("workshopProjectId") || "").trim() || null,
  };
}

export async function createMiniatureAction(formData: FormData) {
  await requireStudioActionAuth();

  const item = await miniatureService().createItem(readMiniatureFields(formData));
  revalidateMiniaturePaths();
  redirect(`/miniatures?selected=${item.id}`);
}

export async function updateMiniatureAction(formData: FormData) {
  await requireStudioActionAuth();

  const id = String(formData.get("id"));
  await miniatureService().updateItem(id, readMiniatureFields(formData));
  revalidateMiniaturePaths();
  redirect(`/miniatures?selected=${id}`);
}

export async function deleteMiniatureAction(formData: FormData) {
  await requireStudioActionAuth();

  await miniatureService().deleteItem(String(formData.get("id")));
  revalidateMiniaturePaths();
  redirect("/miniatures");
}
