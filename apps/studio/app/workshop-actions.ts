"use server";

import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import type {
  WorkshopPaintTarget,
  WorkshopProjectType,
  WorkshopRentalStatus,
  WorkshopStatus,
} from "@uwe/database/server";
import {
  createLifeAdminService,
  parseChecklistFromForm,
  parseColorsFromForm,
  parseFilamentsFromForm,
  parseLinksFromForm,
  parseMaterialsFromForm,
  parsePhotosFromForm,
  prisma,
} from "@uwe/database/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { encodeRentalReturnDue } from "@/src/lib/workshop-rental-due";

function lifeAdmin() {
  return createLifeAdminService(prisma);
}

function parseOptionalInt(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function readRentalNotes(formData: FormData): string {
  const returnDueAt = String(formData.get("returnDueAt") || "").trim() || null;
  const notes = String(formData.get("notes") || "");
  return encodeRentalReturnDue(notes, returnDueAt);
}

function revalidateWorkshopPaths(projectId?: string) {
  revalidatePath("/today");
  revalidatePath("/capture");
  revalidatePath("/workshop");
  revalidatePath("/workshop/recipes");
  revalidatePath("/workshop/rental");
  if (projectId) revalidatePath(`/workshop/${projectId}`);
}

function readWorkshopStructuredFields(formData: FormData) {
  return {
    materialsNeeded: parseMaterialsFromForm(String(formData.get("materialsNeeded") || "")),
    materialsUsed: parseMaterialsFromForm(String(formData.get("materialsUsed") || "")),
    colorsUsed: parseColorsFromForm(String(formData.get("colorsUsed") || "")),
    filamentsUsed: parseFilamentsFromForm(String(formData.get("filamentsUsed") || "")),
    stlLinks: parseLinksFromForm(String(formData.get("stlLinks") || "")),
    referenceImages: parsePhotosFromForm(String(formData.get("referenceImages") || "")),
    progressPhotos: parsePhotosFromForm(String(formData.get("progressPhotos") || "")),
    resultPhotos: parsePhotosFromForm(String(formData.get("resultPhotos") || "")),
    imageGallery: parsePhotosFromForm(String(formData.get("imageGallery") || "")),
  };
}

export async function createWorkshopAction(formData: FormData) {
  await requireStudioActionAuth();

  const structured = readWorkshopStructuredFields(formData);
  const workshop = await lifeAdmin().createWorkshopProject({
    title: String(formData.get("title") || "").trim(),
    projectType: String(formData.get("projectType") || "other") as WorkshopProjectType,
    status: (String(formData.get("status") || "idea") as WorkshopStatus) || "idea",
    description: String(formData.get("description") || ""),
    nextAction: String(formData.get("nextAction") || "").trim() || null,
    notes: String(formData.get("notes") || ""),
    costCents: parseOptionalInt(formData.get("costCents")),
    worldId: String(formData.get("worldId") || "").trim() || null,
    ...structured,
  });

  revalidateWorkshopPaths();
  redirect(`/workshop/${workshop.id}`);
}

export async function updateWorkshopAction(formData: FormData) {
  await requireStudioActionAuth();

  const id = String(formData.get("id"));
  const structured = readWorkshopStructuredFields(formData);
  await lifeAdmin().updateWorkshopProject(id, {
    title: String(formData.get("title") || "").trim(),
    projectType: String(formData.get("projectType")) as WorkshopProjectType,
    status: String(formData.get("status")) as WorkshopStatus,
    description: String(formData.get("description") || ""),
    nextAction: String(formData.get("nextAction") || "").trim() || null,
    notes: String(formData.get("notes") || ""),
    costCents: parseOptionalInt(formData.get("costCents")),
    ...structured,
  });

  revalidateWorkshopPaths(id);
  redirect(`/workshop/${id}`);
}

export async function deleteWorkshopAction(formData: FormData) {
  await requireStudioActionAuth();

  await lifeAdmin().deleteWorkshopProject(String(formData.get("id")));
  revalidateWorkshopPaths();
  redirect("/workshop");
}

export async function promoteCaptureToWorkshopAction(formData: FormData) {
  await requireStudioActionAuth();

  const captureId = String(formData.get("captureId"));
  const workshop = await lifeAdmin().promoteCaptureToWorkshop(captureId, {
    title: String(formData.get("title") || "").trim() || undefined,
    projectType: (String(formData.get("projectType") || "") as WorkshopProjectType) || undefined,
    nextAction: String(formData.get("nextAction") || "").trim() || undefined,
  });

  revalidateWorkshopPaths(workshop.id);
  redirect(`/workshop/${workshop.id}`);
}

export async function createPaintRecipeAction(formData: FormData) {
  await requireStudioActionAuth();

  const workshopProjectId = String(formData.get("workshopProjectId") || "").trim() || null;
  await lifeAdmin().createWorkshopPaintRecipe({
    name: String(formData.get("name") || "").trim(),
    targetType: (String(formData.get("targetType") || "other") as WorkshopPaintTarget) || "other",
    primer: String(formData.get("primer") || ""),
    basecoat: String(formData.get("basecoat") || ""),
    wash: String(formData.get("wash") || ""),
    highlights: String(formData.get("highlights") || ""),
    colorsUsed: parseColorsFromForm(String(formData.get("colorsUsed") || "")),
    resultPhotoUrl: String(formData.get("resultPhotoUrl") || "").trim() || null,
    rating: parseOptionalInt(formData.get("rating")),
    notes: String(formData.get("notes") || ""),
    workshopProjectId,
  });

  revalidateWorkshopPaths(workshopProjectId ?? undefined);
  redirect(workshopProjectId ? `/workshop/${workshopProjectId}` : "/workshop/recipes");
}

export async function updatePaintRecipeAction(formData: FormData) {
  await requireStudioActionAuth();

  const id = String(formData.get("id"));
  const workshopProjectId = String(formData.get("workshopProjectId") || "").trim() || null;
  await lifeAdmin().updateWorkshopPaintRecipe(id, {
    name: String(formData.get("name") || "").trim(),
    targetType: String(formData.get("targetType")) as WorkshopPaintTarget,
    primer: String(formData.get("primer") || ""),
    basecoat: String(formData.get("basecoat") || ""),
    wash: String(formData.get("wash") || ""),
    highlights: String(formData.get("highlights") || ""),
    colorsUsed: parseColorsFromForm(String(formData.get("colorsUsed") || "")),
    resultPhotoUrl: String(formData.get("resultPhotoUrl") || "").trim() || null,
    rating: parseOptionalInt(formData.get("rating")),
    notes: String(formData.get("notes") || ""),
    workshopProjectId,
  });

  revalidateWorkshopPaths(workshopProjectId ?? undefined);
  redirect(workshopProjectId ? `/workshop/${workshopProjectId}` : "/workshop/recipes");
}

export async function deletePaintRecipeAction(formData: FormData) {
  await requireStudioActionAuth();

  const id = String(formData.get("id"));
  const returnTo = String(formData.get("returnTo") || "/workshop/recipes");
  await lifeAdmin().deleteWorkshopPaintRecipe(id);
  revalidateWorkshopPaths();
  redirect(returnTo);
}

export async function createPrintProfileAction(formData: FormData) {
  await requireStudioActionAuth();

  const workshopProjectId = String(formData.get("workshopProjectId") || "").trim() || null;
  await lifeAdmin().createWorkshopPrintProfile({
    name: String(formData.get("name") || ""),
    printer: String(formData.get("printer") || ""),
    nozzle: String(formData.get("nozzle") || ""),
    filament: String(formData.get("filament") || ""),
    layerHeight: String(formData.get("layerHeight") || ""),
    supports: String(formData.get("supports") || ""),
    result: String(formData.get("result") || ""),
    errors: String(formData.get("errors") || ""),
    improvements: String(formData.get("improvements") || ""),
    notes: String(formData.get("notes") || ""),
    workshopProjectId,
  });

  revalidateWorkshopPaths(workshopProjectId ?? undefined);
  redirect(workshopProjectId ? `/workshop/${workshopProjectId}` : "/workshop/print-profiles");
}

export async function deletePrintProfileAction(formData: FormData) {
  await requireStudioActionAuth();

  const returnTo = String(formData.get("returnTo") || "/workshop/print-profiles");
  await lifeAdmin().deleteWorkshopPrintProfile(String(formData.get("id")));
  revalidateWorkshopPaths();
  redirect(returnTo);
}

export async function createTerrainRentalAction(formData: FormData) {
  await requireStudioActionAuth();

  await lifeAdmin().createWorkshopTerrainRental({
    terrainSetName: String(formData.get("terrainSetName") || "").trim(),
    boxLabel: String(formData.get("boxLabel") || ""),
    replacementValueCents: parseOptionalInt(formData.get("replacementValueCents")),
    rentalPriceCents: parseOptionalInt(formData.get("rentalPriceCents")),
    depositCents: parseOptionalInt(formData.get("depositCents")),
    status: (String(formData.get("status") || "available") as WorkshopRentalStatus) || "available",
    damages: String(formData.get("damages") || ""),
    handoverChecklist: parseChecklistFromForm(String(formData.get("handoverChecklist") || "")),
    returnChecklist: parseChecklistFromForm(String(formData.get("returnChecklist") || "")),
    notes: readRentalNotes(formData),
    workshopProjectId: String(formData.get("workshopProjectId") || "").trim() || null,
  });

  revalidateWorkshopPaths();
  redirect("/workshop/rental");
}

export async function updateTerrainRentalAction(formData: FormData) {
  await requireStudioActionAuth();

  const id = String(formData.get("id"));
  await lifeAdmin().updateWorkshopTerrainRental(id, {
    terrainSetName: String(formData.get("terrainSetName") || "").trim(),
    boxLabel: String(formData.get("boxLabel") || ""),
    replacementValueCents: parseOptionalInt(formData.get("replacementValueCents")),
    rentalPriceCents: parseOptionalInt(formData.get("rentalPriceCents")),
    depositCents: parseOptionalInt(formData.get("depositCents")),
    status: String(formData.get("status")) as WorkshopRentalStatus,
    damages: String(formData.get("damages") || ""),
    handoverChecklist: parseChecklistFromForm(String(formData.get("handoverChecklist") || "")),
    returnChecklist: parseChecklistFromForm(String(formData.get("returnChecklist") || "")),
    notes: readRentalNotes(formData),
    workshopProjectId: String(formData.get("workshopProjectId") || "").trim() || null,
  });

  revalidateWorkshopPaths();
  redirect("/workshop/rental");
}

export async function deleteTerrainRentalAction(formData: FormData) {
  await requireStudioActionAuth();

  await lifeAdmin().deleteWorkshopTerrainRental(String(formData.get("id")));
  revalidateWorkshopPaths();
  redirect("/workshop/rental");
}
