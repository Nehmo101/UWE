import {
  getAppRepository,
  type AssetType,
  type Visibility,
} from "@uwe/database/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function repo() {
  return getAppRepository();
}

export async function linkAssetToPageAction(formData: FormData) {
  const worldSlug = String(formData.get("worldSlug"));
  const assetId = String(formData.get("assetId"));
  const pageId = String(formData.get("pageId"));

  if (pageId) {
    await repo().linkAssetToPage(assetId, pageId);
  }

  revalidatePath(`/worlds/${worldSlug}/assets`);
  redirect(`/worlds/${worldSlug}/assets?linked=1`);
}

export async function updateAssetAction(formData: FormData) {
  const worldSlug = String(formData.get("worldSlug"));
  const assetId = String(formData.get("assetId"));

  await repo().updateAsset(assetId, {
    title: String(formData.get("title")),
    description: String(formData.get("description") || "") || null,
    type: formData.get("type") as AssetType,
    visibility: formData.get("visibility") as Visibility,
    // Only overwrite tags when the form actually submits the field.
    tags: formData.has("tags")
      ? String(formData.get("tags") || "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : undefined,
  });

  revalidatePath(`/worlds/${worldSlug}/assets`);
  redirect(`/worlds/${worldSlug}/assets?saved=1`);
}
