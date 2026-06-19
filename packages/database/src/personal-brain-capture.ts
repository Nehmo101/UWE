import type { CaptureType } from "./generated/prisma/client";
import { PERSONAL_BRAIN_CATEGORIES } from "./life-admin-service";

const CAPTURE_TYPE_TO_BRAIN_CATEGORY: Partial<Record<CaptureType, (typeof PERSONAL_BRAIN_CATEGORIES)[number]>> = {
  hardware: "hardware_homelab",
  contract_expense: "contracts_expenses",
  art_miniature_terrain: "miniatures_terrain",
  project_idea: "personal_notes",
  uwe_todo: "uwe_coding",
  quick_note: "personal_notes",
  link: "personal_notes",
  file_image: "personal_notes",
  dnd_idea: "personal_notes",
};

export function resolveBrainCategoryForCaptureType(
  captureType: CaptureType,
  override?: string | null,
): string | null {
  const normalizedOverride = override?.trim();
  if (
    normalizedOverride &&
    (PERSONAL_BRAIN_CATEGORIES as readonly string[]).includes(normalizedOverride)
  ) {
    return normalizedOverride;
  }
  return CAPTURE_TYPE_TO_BRAIN_CATEGORY[captureType] ?? "personal_notes";
}

export function buildLifeBrainContentFromCapture(input: {
  content: string;
  url?: string | null;
}): string {
  const parts = [input.content.trim()];
  if (input.url?.trim()) {
    parts.push(`Quelle: ${input.url.trim()}`);
  }
  return parts.filter(Boolean).join("\n\n");
}
