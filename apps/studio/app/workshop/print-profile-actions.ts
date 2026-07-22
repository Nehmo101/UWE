"use server";
import { brainPrisma } from "@uwe/database/brain-client";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createLifeAdminService, prisma } from "@uwe/database/server";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";

interface ImportProfile {
  name?: string;
  printer?: string;
  nozzle?: string;
  filament?: string;
  layerHeight?: string;
  supports?: string;
  result?: string;
  errors?: string;
  improvements?: string;
  notes?: string;
}

export async function importPrintProfilesAction(formData: FormData) {
  await requireStudioActionAuth();

  const raw = String(formData.get("json") ?? "").trim();
  if (!raw) {
    redirect("/workshop/print-profiles?error=empty");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    redirect("/workshop/print-profiles?error=parse");
  }

  const rows = Array.isArray(parsed) ? parsed : [parsed];
  const service = createLifeAdminService(brainPrisma, prisma);
  let imported = 0;

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const profile = row as ImportProfile;
    await service.createWorkshopPrintProfile({
      name: String(profile.name ?? ""),
      printer: String(profile.printer ?? ""),
      nozzle: String(profile.nozzle ?? ""),
      filament: String(profile.filament ?? ""),
      layerHeight: String(profile.layerHeight ?? ""),
      supports: String(profile.supports ?? ""),
      result: String(profile.result ?? ""),
      errors: String(profile.errors ?? ""),
      improvements: String(profile.improvements ?? ""),
      notes: String(profile.notes ?? ""),
    });
    imported += 1;
  }

  revalidatePath("/workshop/print-profiles");
  redirect(`/workshop/print-profiles?imported=${imported}`);
}
