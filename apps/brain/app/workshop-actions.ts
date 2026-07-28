"use server";

import type {
  WorkshopPaintTarget,
  WorkshopProjectType,
  WorkshopRentalStatus,
  WorkshopStatus,
} from "@uwe/database/server";
import { revalidatePath } from "next/cache";
import { lifeAdmin, lines, revalidateBrainPaths, str } from "@/src/lib/brain-action-shared";
import { requireBrainActionAuth } from "@/src/lib/brain-action-auth";

/**
 * Werkstatt — Projekte, Farbrezepte, Druckprofile und Terrain-Verleih.
 *
 * Abschnitt H5, Brain gewinnt. Die vier Bereiche lagen in Studio über fünf
 * Seiten verteilt; die Services dafür liegen längst in `@uwe/database`, hier
 * stehen nur die Form-Adapter.
 *
 * Ohne Welt-Zuordnung: eine Werkstattarbeit gehört zu dir, nicht zu einer Welt.
 */

/** Euro-Eingabe ("9,99" oder "9.99") in Cents. */
function euroToCents(value: FormDataEntryValue | null): number | null {
  const raw = str(value).replace(",", ".");
  if (!raw) return null;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

function optionalDate(value: FormDataEntryValue | null): Date | null {
  const raw = str(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function optionalRating(value: FormDataEntryValue | null): number | null {
  const raw = Number.parseInt(str(value), 10);
  if (!Number.isFinite(raw)) return null;
  return Math.min(Math.max(raw, 1), 5);
}

/** Die Listenfelder eines Werkstattprojekts — je Zeile ein Eintrag. */
function structuredFields(formData: FormData) {
  return {
    materialsNeeded: lines(formData.get("materialsNeeded")),
    materialsUsed: lines(formData.get("materialsUsed")),
    colorsUsed: lines(formData.get("colorsUsed")),
    filamentsUsed: lines(formData.get("filamentsUsed")),
    stlLinks: lines(formData.get("stlLinks")),
  };
}

/* ── Projekte ─────────────────────────────────────────────────────────── */

export async function createWorkshopAction(formData: FormData) {
  await requireBrainActionAuth();
  const title = str(formData.get("title"));
  if (!title) return;

  await lifeAdmin().createWorkshopProject({
    title,
    projectType: (str(formData.get("projectType")) || "other") as WorkshopProjectType,
    status: (str(formData.get("status")) || "idea") as WorkshopStatus,
    description: str(formData.get("description")),
    nextAction: str(formData.get("nextAction")) || null,
    nextActionDate: optionalDate(formData.get("nextActionDate")),
    notes: str(formData.get("notes")),
    costCents: euroToCents(formData.get("cost")),
    ...structuredFields(formData),
  });
  revalidateBrainPaths();
}

export async function updateWorkshopAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("id"));
  if (!id) return;

  await lifeAdmin().updateWorkshopProject(id, {
    title: str(formData.get("title")),
    projectType: str(formData.get("projectType")) as WorkshopProjectType,
    status: str(formData.get("status")) as WorkshopStatus,
    description: str(formData.get("description")),
    nextAction: str(formData.get("nextAction")) || null,
    nextActionDate: optionalDate(formData.get("nextActionDate")),
    notes: str(formData.get("notes")),
    costCents: euroToCents(formData.get("cost")),
    ...structuredFields(formData),
  });
  revalidateBrainPaths();
  revalidatePath(`/workshop/${id}`);
}

/** Ein Schritt weiter in der Status-Kette, ohne das ganze Formular. */
export async function advanceWorkshopStatusAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("id"));
  if (id) await lifeAdmin().advanceWorkshopStatus(id);
  revalidateBrainPaths();
  if (id) revalidatePath(`/workshop/${id}`);
}

export async function deleteWorkshopAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("id"));
  if (id) await lifeAdmin().deleteWorkshopProject(id);
  revalidateBrainPaths();
}

/* ── Farbrezepte ──────────────────────────────────────────────────────── */

export async function createPaintRecipeAction(formData: FormData) {
  await requireBrainActionAuth();
  const name = str(formData.get("name"));
  if (!name) return;

  await lifeAdmin().createWorkshopPaintRecipe({
    name,
    targetType: (str(formData.get("targetType")) || "miniature") as WorkshopPaintTarget,
    primer: str(formData.get("primer")),
    basecoat: str(formData.get("basecoat")),
    wash: str(formData.get("wash")),
    highlights: str(formData.get("highlights")),
    colorsUsed: lines(formData.get("colorsUsed")),
    rating: optionalRating(formData.get("rating")),
    notes: str(formData.get("notes")),
    workshopProjectId: str(formData.get("workshopProjectId")) || null,
  });
  revalidateBrainPaths();
  revalidatePath("/workshop/recipes");
}

export async function updatePaintRecipeAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("id"));
  if (!id) return;

  await lifeAdmin().updateWorkshopPaintRecipe(id, {
    name: str(formData.get("name")),
    targetType: (str(formData.get("targetType")) || "miniature") as WorkshopPaintTarget,
    primer: str(formData.get("primer")),
    basecoat: str(formData.get("basecoat")),
    wash: str(formData.get("wash")),
    highlights: str(formData.get("highlights")),
    colorsUsed: lines(formData.get("colorsUsed")),
    rating: optionalRating(formData.get("rating")),
    notes: str(formData.get("notes")),
  });
  revalidatePath("/workshop/recipes");
}

export async function deletePaintRecipeAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("id"));
  if (id) await lifeAdmin().deleteWorkshopPaintRecipe(id);
  revalidatePath("/workshop/recipes");
}

/* ── Druckprofile ─────────────────────────────────────────────────────── */

export async function createPrintProfileAction(formData: FormData) {
  await requireBrainActionAuth();
  const name = str(formData.get("name"));
  if (!name) return;

  await lifeAdmin().createWorkshopPrintProfile({
    name,
    printer: str(formData.get("printer")),
    nozzle: str(formData.get("nozzle")),
    filament: str(formData.get("filament")),
    layerHeight: str(formData.get("layerHeight")),
    supports: str(formData.get("supports")),
    result: str(formData.get("result")),
    errors: str(formData.get("errors")),
    improvements: str(formData.get("improvements")),
    notes: str(formData.get("notes")),
    workshopProjectId: str(formData.get("workshopProjectId")) || null,
  });
  revalidatePath("/workshop/print-profiles");
}

export async function deletePrintProfileAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("id"));
  if (id) await lifeAdmin().deleteWorkshopPrintProfile(id);
  revalidatePath("/workshop/print-profiles");
}

/* ── Terrain-Verleih ──────────────────────────────────────────────────── */

export async function createTerrainRentalAction(formData: FormData) {
  await requireBrainActionAuth();
  const terrainSetName = str(formData.get("terrainSetName"));
  if (!terrainSetName) return;

  await lifeAdmin().createWorkshopTerrainRental({
    terrainSetName,
    boxLabel: str(formData.get("boxLabel")),
    replacementValueCents: euroToCents(formData.get("replacementValue")),
    rentalPriceCents: euroToCents(formData.get("rentalPrice")),
    depositCents: euroToCents(formData.get("deposit")),
    status: (str(formData.get("status")) || "available") as WorkshopRentalStatus,
    handoverChecklist: lines(formData.get("handoverChecklist")),
    returnChecklist: lines(formData.get("returnChecklist")),
    notes: str(formData.get("notes")),
  });
  revalidatePath("/workshop/rental");
}

export async function updateTerrainRentalAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("id"));
  if (!id) return;

  await lifeAdmin().updateWorkshopTerrainRental(id, {
    terrainSetName: str(formData.get("terrainSetName")),
    boxLabel: str(formData.get("boxLabel")),
    replacementValueCents: euroToCents(formData.get("replacementValue")),
    rentalPriceCents: euroToCents(formData.get("rentalPrice")),
    depositCents: euroToCents(formData.get("deposit")),
    status: str(formData.get("status")) as WorkshopRentalStatus,
    damages: str(formData.get("damages")),
    handoverChecklist: lines(formData.get("handoverChecklist")),
    returnChecklist: lines(formData.get("returnChecklist")),
    notes: str(formData.get("notes")),
  });
  revalidatePath("/workshop/rental");
}

export async function deleteTerrainRentalAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("id"));
  if (id) await lifeAdmin().deleteWorkshopTerrainRental(id);
  revalidatePath("/workshop/rental");
}
